# 1 Minute Hotspot — Build Spec (single source of truth)

Thai-only short-form news portal. Video clips (~60s) come from a
Facebook Page Reels/Video feed; each clip gets a real, indexable article page.

REVISED: this started bilingual (th/en). The live Facebook feed returns zero
English — 50/50 clips had `en` byte-identical to `th` — so every /en page was
duplicate content and `hreflang="en"` was a false signal pointing at Thai.
i18n was removed entirely. There is one language and no locale prefix.
Goal: rank on Google page 1 for Thai ข่าว queries.

Stack (pinned, already installed — do NOT upgrade or add deps without need):
next@16.3.2 (App Router, Turbopack) · react@19.2.8 · tailwindcss@4 (CSS-first `@theme`,
NO tailwind.config.js) · typescript@5 · pnpm
No i18n library. Thai UI copy lives as literals at the point of use.

Shell commands go through `rtk` (e.g. `rtk pnpm build`) — same output, fewer tokens.

---

## 1. Design DNA — "the 60-second rundown"

Reference *mood* only (never copy): Thai broadcast news portals — dark chrome,
photo-led, punchy Thai headlines. Our structural motif is deliberately different:
a **TV rundown sheet** (numbered running order + timecodes), NOT a hero carousel
with stacked photo-card sections.

### Tokens — `app/globals.css`, Tailwind v4 `@theme` block, OKLCH only

```css
@theme {
  --color-ink:      oklch(0.155 0.014 264); /* page base */
  --color-surface:  oklch(0.205 0.016 264); /* cards */
  --color-raise:    oklch(0.255 0.018 264); /* hover / elevated */
  --color-hairline: oklch(0.325 0.018 264);
  --color-fg:       oklch(0.972 0.004 264);
  --color-muted:    oklch(0.715 0.014 264);
  --color-hot:      oklch(0.745 0.185 62);  /* signal amber — the "hotspot" */
  --color-hot-deep: oklch(0.585 0.165 48);
  --color-live:     oklch(0.635 0.235 27);  /* LIVE badge ONLY, nothing else */
}
```

### Type

`next/font/google`, subsets `["latin","thai"]`, exposed as CSS vars on `<html>`:
- Display / headlines: **Anuphan** 600,700 → `--font-anuphan`
- Body / UI: **IBM Plex Sans Thai** 400,500 → `--font-plex-thai`
- Timecodes, kickers, dates: **IBM Plex Mono** 400,500 → `--font-plex-mono`

Wire into `@theme` as `--font-display`, `--font-body`, `--font-mono`.
Headings are ALWAYS roman — `font-style: normal`. No italic headings, ever.

### Rules (non-negotiable)

- Container max-width `1240px`; gutters `20px` mobile / `32px` ≥1024px.
- Separation is by **hairline rules and space**, never by shadow. `box-shadow` is
  banned. Radius `2px` everywhere; only pill badges are fully rounded.
- **The 60-second motif** is the signature: every clip card/row carries a 2px
  `--color-hot` rail whose width = `min(durationSec/60, 1) * 100%`, and a mono
  timecode `0:47`. This is what makes the site ours — use it consistently.
- Section headers: mono kicker (`01 — ข่าวกำลังมา`) above a display heading, with a
  left rule. Section heads collapse to one column on mobile.
- Banned AI-slop: gradient text, glassmorphism, emoji bullets, fake browser/phone
  chrome, purple-blue gradients, generic 3-up feature cards, invented metrics.
- **Honest copy**: never invent a statistic, view count, testimonial, or fact. If a
  value isn't in the data, render `—` or omit the element.

### Mobile — verified at 320 / 375 / 414 / 768px

- No horizontal scroll. `html, body { overflow-x: clip }` (never `hidden`).
- No clickable text wraps to two lines (nav links, buttons, breadcrumbs, CTAs).
- Image-bearing grid tracks use `minmax(0, 1fr)`, never bare `1fr`.
- Long Thai/English headlines: `overflow-wrap: anywhere; min-width: 0`.

---

## 2. Information architecture

Single language (Thai). Routes are unprefixed.

```
/                                home
/news/[slug]                     article page per clip  ← the SEO surface
/category/[category]             category index
/videos                          all clips, paginated-lite
/sitemap.xml  /news-sitemap.xml  /robots.txt
```

Categories (`CategorySlug`) — Thai label via `categoryLabel()`:
| slug | label |
|---|---|
| `society` | ข่าวสังคม|
| `entertainment` | บันเทิง|
| `politics` | การเมือง|
| `viral` | ไวรัล|
| `economy` | เศรษฐกิจ|

### Home page structure (this exact order — it is the anti-template rhythm)

1. **Ticker strip** — latest 5 headlines, horizontal scroll-snap, mono timestamps.
   No JS marquee, no autoplay.
2. **THE LEAD** — one dominant story. 16:9 still, scrim, headline bottom-left.
   Single item, not a carousel.
3. **RUNDOWN** — the signature block. Numbered `01`–`08` text-first rows, 96px
   thumbnail left, headline centre, mono timecode right-aligned, hot rail per row.
4. **Category strips** — one strip per category, 4-up grid of clip cards.
5. Footer — channel identity, socials, ad-sales line, menu duplication.

---

## 3. Data model — `lib/types.ts`

```ts
export type CategorySlug = "society" | "entertainment" | "politics" | "viral" | "economy";

export type Clip = {
  id: string;
  slug: string;                 // url-safe, stable, derived from id + transliterated title
  source: "facebook" | "youtube" | "sample";
  title: string;
  summary: string;              // 1-2 sentences, used for meta description
  body: string;                 // article text, paragraphs joined by "\n\n"
  category: CategorySlug;
  publishedAt: string;          // ISO 8601
  updatedAt: string;            // ISO 8601
  durationSec: number;
  thumbnail: { url: string; width: number; height: number };
  embedUrl: string;             // iframe src (FB video plugin or YT embed)
  permalink: string;            // canonical source URL
  tags: string[];
  /** Present only on the single-clip path (getClip). The publisher article the
   *  Page linked in its own comment thread — see §6. */
  sourceArticle?: SourceArticle;
};

export type SourceArticle = {
  url: string;
  title?: string;
  excerpt?: string;             // capped at 600 chars, never the full text
  siteName?: string;
};
```

## 4. Data providers — `lib/clips.ts`, `lib/providers/*`

`getClips(): Promise<Clip[]>` — the ONLY entry point pages use. Also
`getClip(slug)`, `getClipsByCategory(cat)`.

Selection order:
1. Facebook, if `FB_PAGE_ID` **and** `FB_ACCESS_TOKEN` are set.
2. YouTube, if `YT_API_KEY` **and** `YT_CHANNEL_ID` are set.
3. Sample data (`lib/sample-clips.ts`) otherwise.

**`getClips()` must never throw and never break a build.** Wrap provider calls in
try/catch; on any failure log a warning to `console.warn` and fall back to sample
data. The site must build and render green with zero credentials present.

### Facebook read path — important

`GET /{page-id}/video_reels` is a **publishing** edge; its read support is not
reliable. Read from the videos edge instead and filter for reel-length clips:

```
https://graph.facebook.com/{FB_API_VERSION}/{FB_PAGE_ID}/videos
  ?fields=id,title,description,permalink_url,created_time,updated_time,length,
          picture,thumbnails{uri,width,height},source
  &limit=50
  &access_token={FB_ACCESS_TOKEN}
```
Keep items with `length <= 90`. Leave a short code comment stating why
`video_reels` is not used. Default `FB_API_VERSION` to `v26.0` (verified live;
there is no v27.0).

### YouTube read path

`search.list` (channelId, order=date, type=video, maxResults=50) →
`videos.list` (id, part=snippet,contentDetails) for ISO-8601 `duration`. Key-only
auth via `YT_API_KEY` — the repo's `client_secrets.json` is an OAuth **desktop**
client and is NOT usable for server-side public reads. Do not attempt OAuth.

### Article body derivation — honest, never fabricated

From the FB/YT `description`: first non-empty line → `title`, remainder split on
blank lines → `body` paragraphs, first ~160 chars → `summary`. If the description
yields under 200 characters of body, append a single labelled placeholder
paragraph (`รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ`) — never pad with invented facts.

Hashtags are stripped from the headline and routed into `tags`; captions are
otherwise one line, so most bodies are placeholder-only. That is a real content
limitation, not a bug — §6 is the fix.

`pickCategory` matches title/body text first and consults `tags` only when the
text matches nothing. Creator hashtags are noisy (a stabbing tagged #บันเทิง)
and must never outrank the article's own words.

### Env — `.env.example`

```
NEXT_PUBLIC_SITE_URL=https://www.1minhotspot.site
FB_PAGE_ID=
FB_ACCESS_TOKEN=
FB_API_VERSION=v26.0
YT_API_KEY=
YT_CHANNEL_ID=
```

Freshness: fetches use `next: { revalidate: 3600 }`; pages export
`export const revalidate = 3600`. An hour is right for a Page that posts a few
reels a day, and every article page additionally fetches a third-party
publisher — a 5-minute window would hammer them for no editorial gain.

---

## 5. SEO requirements (the whole point)

- Per-page `generateMetadata`: title, description, canonical, OpenGraph
  (`type: "article"`, publishedTime, modifiedTime, images), Twitter
  `summary_large_image`. No `alternates.languages` — there is one language.
- Article pages emit **two** JSON-LD blocks: `NewsArticle` and `VideoObject`
  (`uploadDate`, `duration` as ISO-8601 `PT#M#S`, `thumbnailUrl`, `embedUrl`,
  `contentUrl` where known). Home emits `WebSite` + `Organization`;
  article pages also emit `BreadcrumbList`.
- All JSON-LD dates go through `toISOString()` — Graph returns
  `+0000` offsets, which schema.org consumers accept but Search Console
  flags inconsistently.
- When a clip's body came from a publisher article, `NewsArticle` carries
  `isBasedOn` and `citation` pointing at that source URL. This is the honest
  signal that we summarised someone else's reporting, and it is what keeps the
  page out of duplicate-content territory.
- `app/sitemap.ts` — every route, single self-referencing canonical, no `alternates`.
- `app/news-sitemap.xml/route.ts` — Google News sitemap, `<news:news>` entries for
  clips published in the last 48h only, `<news:publication><news:language>th`.
- `app/robots.ts` — allow all, point at both sitemaps.
- `<html lang="th">`. No hreflang anywhere.
- All emitted URLs percent-encode their Thai path segments — done once inside
  `absoluteUrl()` so canonical, `<loc>` and JSON-LD `@id` stay byte-identical.
- Images via `next/image` with explicit width/height; `priority` only on the LEAD.

---

## 6. Article body content — where the words come from

Ranked, best first. A clip takes the highest tier available; there is no blending.

1. **`shortsScript` from the n8n pipeline.** The existing n8n workflows already
   feed each source article to Gemini with a prompt that mandates
   `เขียนใหม่ด้วยสำนวนของตัวเอง 100% … ห้ามยกประโยคจากต้นฉบับมาใช้ตรงๆ`. That output is
   100% original Thai prose — our own editorial text, written for the same clip
   that is embedded on the page. No copyright exposure, no duplicate-content
   penalty, and it is already being generated. Until now it was spoken by TTS
   and then thrown away; the workflows are modified to persist it.
2. **Publisher excerpt.** `lib/providers/source-article.ts` resolves the source
   URL — the Page's own `อ่านเพิ่มเติม` comment first, then the `source_url` n8n
   stored in `clip_scripts` — and takes a **≤600 char** excerpt, attributed via
   `isBasedOn`/`citation`. The comment wins because it is what a reader sees
   under the reel, so page and comment can never disagree; the stored URL covers
   a comment that was never posted, was edited, fell off the end of the 50 the
   comments edge returns, or an expired `FB_ACCESS_TOKEN`. Both paths go through
   the same `sanitizeUrl` (protocol check, tracking params, fragment).
   Fallback only.

   Note this tier is **not** gated on tier 1 being absent: the attributed source
   block renders alongside a `shortsScript` body, because attribution is owed
   whether or not we wrote our own prose. Only the *placeholder* is suppressed
   when an excerpt is present.
3. **Placeholder.** `รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ`, one paragraph, never padded.

Never republish a publisher's full text. It infringes, and as duplicate content
it actively works against the ranking goal in the first place.

Khaosod (12 of 14 unresolved sources) sits behind Cloudflare TLS/HTTP
fingerprinting: `curl` gets 200, Node `fetch()` gets 403 regardless of headers.
Impersonating a browser TLS stack to get around it is **out of scope and will not
be done** — Khaosod bodies come from tier 1 or stay at tier 3.

---

## 7. Durability — the 16-hour problem

The Graph `videos` edge with `limit=50` returns roughly **16 hours** of posts
(measured: newest `2026-08-21T15:47Z`, oldest `2026-08-20T23:27Z`, with
`paging.next` present). Nothing follows the cursor, so anything older simply
vanishes.

Consequences if left alone: every `/news/[slug]` URL 404s within a day, the
sitemap shrinks in lockstep with it, and Google never accumulates an index.
This defeats the entire point of the site.

Fix: clips are **persisted** to Neon Postgres and `getClips()` returns the union
of the store and the live feed, store rows never expiring. Two write paths:

- `POST /api/ingest` — n8n pushes `{video_id, title, shortsScript, link, image,
  published_at}`. Shared-secret auth compared with `crypto.timingSafeEqual`.
  Push, not pull: Vercel cannot reach the self-hosted n8n / NocoDB / Postgres on
  the home network, so no read-side token would help.
- The Facebook provider upserts whatever it sees on each revalidate, so the
  archive grows even for clips n8n never touched.

`getDb()` is lazy — Next evaluates top-level module code at build time and a
top-level `neon(process.env.DATABASE_URL!)` crashes the build when the env var
isn't set yet. Never wrap the client in a `Proxy`.
