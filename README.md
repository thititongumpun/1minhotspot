# 1 Minute Hotspot

Thai-only short-form news site. Video clips (~60 seconds) pulled from a Facebook Page feed; each clip becomes an indexable article page for Google News and ข่าว search.

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The site runs immediately with **zero credentials** — it falls back to 12 built-in sample clips. `pnpm dev` works on first run.

## Site URL

Set `NEXT_PUBLIC_SITE_URL` in `.env.local` (or your hosting provider's env config) to the site's real production origin, e.g. `https://www.1minhotspot.site`. It drives canonical URLs, `metadataBase`, both sitemaps (`/sitemap.xml`, `/news-sitemap.xml`), and every OpenGraph image URL. If it is left unset or wrong in production, social previews and canonical links point at the wrong host.

## Connecting a Real Feed

### Facebook (Primary)

Set these in `.env.local`:
- `FB_PAGE_ID` — numeric page ID (Meta Business Suite → Page → About)
- `FB_ACCESS_TOKEN` — long-lived **Page** access token (Graph API Explorer → exchange for long-lived)
- `FB_API_VERSION` — defaults to `v26.0`

Requires `pages_read_engagement` permission. The code reads from the `/videos` edge, not `/video_reels`, because the reels endpoint is a publishing edge with unreliable read support and omits required fields like `length` and `thumbnails`. Reels published by the page appear on `/videos` anyway.

Endpoint: `/{page-id}/videos?fields=id,title,description,permalink_url,created_time,updated_time,length,picture,thumbnails{uri,width,height},source`

Videos over 90 seconds are filtered out.

### YouTube (Fallback)

Set these in `.env.local`:
- `YT_API_KEY` — plain YouTube Data API v3 key (Google Cloud → APIs & Services → Credentials)
- `YT_CHANNEL_ID` — channel ID (starts with `UC...`)

**Important:** The `client_secrets.json` in this repo is an OAuth *desktop* client and is **not** usable for server-side public reads. Use a plain API key instead.

### Provider Selection

Order (first match wins):
1. Facebook, if both `FB_PAGE_ID` and `FB_ACCESS_TOKEN` are set
2. YouTube, if both `YT_API_KEY` and `YT_CHANNEL_ID` are set
3. Sample data otherwise

Any provider failure logs a warning and falls back to samples. The site never breaks.

## Persistence — why it exists

The Graph `/videos` edge with `limit=50` only reaches about **16 hours** back
(measured, with `paging.next` still present). Without a store, every
`/news/[slug]` URL 404s within a day, the sitemap shrinks with it, and Google
never accumulates an index — which defeats the point of the site.

Clips are therefore persisted to Neon Postgres and `getClips()` returns the
union of the store and the live feed. Stored rows never expire.

### Setup

```bash
vercel link
vercel integration add neon --yes
vercel env pull .env.local --yes
```

Then apply the schema once:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Round-trip check against the real database:

```bash
DATABASE_URL='postgres://...' rtk pnpm exec tsx scripts/store-smoke.ts
```

`DATABASE_URL` unset is a **supported** state: every `lib/store.ts` call logs a
warning, returns empty, and the site falls back to the live feed alone.

### Two tables, one join

`clips` is written by the site itself: `lib/clips.ts` archives everything the
live Facebook feed shows on every revalidate.

`clip_scripts` is written by n8n: the Thai rewrite, keyed by the **Facebook
video id**. It is a separate table because n8n POSTs the rewrite the moment it
publishes a reel — up to an hour before the site first sees that reel — so the
matching `clips` row may not exist yet, and a stub row is impossible against a
table full of `NOT NULL` columns.

The `clips_full` view left-joins the two. Every store read goes through it, so
no call site can forget the lookup. A clip with no rewrite yet just has NULLs
and falls back to the Facebook caption body.

### `POST /api/ingest`

n8n sends **only the rewrite** — `videoId`, `scriptTh`, `rewrittenTitle`,
`sourceUrl`, `sourcePublisher`. Everything else about a clip comes from the
Facebook `/videos` edge, so sending whole clips would duplicate data the site
already owns and risk two URLs for one story.

Push, not pull — Vercel cannot reach n8n / NocoDB / Postgres on the home
network, so no read-side token would help.

- Header `x-ingest-secret`, compared against `INGEST_SECRET` with
  `crypto.timingSafeEqual`.
- **Fails closed**: if `INGEST_SECRET` is unset the route rejects everything.
- Body capped at 256 KB; oversized requests get 413.
- Responses: `401` bad/absent secret · `400` invalid payload · `405` non-POST ·
  `413` too large · `503` store unavailable (not persisted, safe to retry).
- A payload with a `videoId` and nothing else is rejected with `400` rather than
  answering `200` to a no-op — that would hide a broken n8n expression for weeks.

The n8n side stores Gemini's `shortsScript` — a 100%-original Thai rewrite,
already generated for TTS and previously discarded. See
`/home/thiti/container/n8n/workflows/MIGRATION.md` for the columns to add before
importing the modified workflows.

## Project Layout

```
app/              Next.js App Router pages and layouts
components/       React components
lib/              Data layer: clips.ts (entry point), providers/, types, utilities
```

## Scripts

```bash
pnpm dev          Development server (next dev)
pnpm build        Production build (next build)
pnpm start        Start production server (next start)
pnpm lint         Run eslint
```

Data-layer self-check (clips.ts shape validation, sample data integrity):
```bash
rtk pnpm exec tsx lib/clips.test.ts
```

## SEO

- Per-clip article pages with unique slugs
- NewsArticle and VideoObject JSON-LD on article pages
- `/sitemap.xml` (home, `/videos`, categories, articles; Thai slugs percent-encoded)
- `/news-sitemap.xml` (Google News; includes only clips from last 48h)
- ISR revalidation every 3600 seconds

## Known Limitations

**Sample data is not real news.** With no Facebook or YouTube credentials configured, the site serves 12 invented sample clips (`lib/sample-clips.ts`) so the app runs on first checkout. Every clip carries a `source` field (`"facebook"`, `"youtube"`, or `"sample"`), and the server logs a console warning (`[clips] ... using sample data`) whenever it falls back — check that before assuming a deployed feed is live. `/sitemap.xml` lists every clip regardless of `source`; `/news-sitemap.xml` filters only by a 48-hour freshness window, not by `source`, so sample clips are not guaranteed to be excluded from either sitemap.

**One-line captions produce thin article pages.** Facebook reel captions are usually a single line. `lib/normalize.ts` deliberately refuses to fabricate body text: when the derived article body is under 200 characters, a fixed placeholder ("Further details are being verified." / "รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ") is appended instead of invented prose. Google News will not index thin pages. Ranking for ข่าว search needs real article text — either longer captions on the source posts, or hand-written copy added separately.

## Security

- `.env.local` and `client_secrets.json` are gitignored
- `FB_ACCESS_TOKEN` is a live credential — never commit it
- All credentials are server-side only (not `NEXT_PUBLIC_*`)
