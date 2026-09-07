import { getDb, type Sql } from "./db";
import type { CategorySlug, Clip } from "./types";

/** What n8n POSTs after it publishes a reel. Keyed by the Facebook video id. */
export type ScriptInput = {
  videoId: string;
  scriptTh?: string | null;
  articleTh?: string | null;
  rewrittenTitle?: string | null;
  sourceUrl?: string | null;
  sourcePublisher?: string | null;
};

const DEFAULT_LIMIT = 500;

/** timestamptz comes back as a Date from the driver; be tolerant of a string. */
const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();

/**
 * DB row → the existing `Clip` type. No parallel type: whatever comes out of
 * here is what pages already know how to render.
 *
 * `sourceArticle` is deliberately left unset. We store the source URL and
 * publisher, but `SourceArticle.excerpt` is required and we have no excerpt
 * column — synthesising one would be fabricating quoted material. lib/clips.ts
 * already resolves the real excerpt lazily on the article path.
 */
const toClip = (r: Record<string, unknown>): Clip => ({
  id: String(r.id),
  slug: String(r.slug),
  source: r.source as Clip["source"],
  // The rewritten headline wins when n8n produced one; the slug stays derived
  // from the original title so the URL never moves.
  title: (r.rewritten_title as string) || String(r.title),
  // List rows carry none of these columns (see getStoredClips): the coalesces
  // below yield "" / false, which is the same state a caption-less clip already
  // has. getClip() in lib/clips.ts hydrates the article path from the full row.
  summary: (r.summary as string) ?? "",
  // The rewritten narration IS the article body when present. When it is not,
  // fall through to whatever the provider description yielded — possibly "",
  // which the site's honest-placeholder logic already handles.
  body: (r.article_th as string) || (r.script_th as string) || (r.body as string) || "",
  // Kept beside the coalesce above, so the two can never disagree.
  hasScript: Boolean(r.article_th || r.script_th),
  // The narration is the transcript whichever text is the body; when there is
  // no written article the two are the same string, as before.
  ...(r.script_th ? { transcript: r.script_th as string } : {}),
  category: r.category as CategorySlug,
  publishedAt: iso(r.published_at),
  updatedAt: iso(r.updated_at),
  durationSec: Number(r.duration_sec),
  thumbnail: {
    url: String(r.thumbnail_url),
    width: Number(r.thumbnail_width),
    height: Number(r.thumbnail_height),
  },
  embedUrl: String(r.embed_url),
  permalink: String(r.permalink),
  tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  // 0 and "no count" are different facts (see Clip.views) — only surface a
  // real, positive count, never a fabricated 0 for a clip that never had one.
  views: Number(r.views) > 0 ? Number(r.views) : undefined,
});

/**
 * Never-throw wrapper, matching the discipline in lib/clips.ts: with no
 * DATABASE_URL, or on any query failure, log and return the fallback. The site
 * must build and serve from the live Facebook feed with no database at all.
 */
async function run<T>(label: string, fallback: T, fn: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = getDb();
  if (!sql) {
    console.warn(`[store] ${label}: DATABASE_URL unset — skipping.`);
    return fallback;
  }
  try {
    return await fn(sql);
  } catch (err) {
    console.warn(`[store] ${label} failed:`, (err as Error).message);
    return fallback;
  }
}

/**
 * Idempotent on `slug`: re-archiving a clip the live feed still shows must not
 * duplicate a row. `published_at` is never overwritten — the first publish time
 * is the truth. The Thai rewrite lives in clip_scripts and is untouched here.
 */
export async function upsertClip(clip: Clip): Promise<boolean> {
  return run(`upsertClip(${clip.slug})`, false, async (sql) => {
    await sql`
      insert into clips (
        slug, id, source, title, summary, body, category,
        published_at, updated_at, duration_sec,
        thumbnail_url, thumbnail_width, thumbnail_height,
        embed_url, permalink, tags, views
      ) values (
        ${clip.slug}, ${clip.id}, ${clip.source}, ${clip.title}, ${clip.summary},
        ${clip.body}, ${clip.category},
        ${clip.publishedAt}, ${clip.updatedAt}, ${clip.durationSec},
        ${clip.thumbnail.url}, ${clip.thumbnail.width}, ${clip.thumbnail.height},
        ${clip.embedUrl}, ${clip.permalink}, ${clip.tags}::text[], ${clip.views ?? 0}
      )
      on conflict (slug) do update set
        id               = excluded.id,
        source           = excluded.source,
        title            = excluded.title,
        summary          = excluded.summary,
        body             = excluded.body,
        category         = excluded.category,
        -- published_at intentionally absent: the first publish time is the truth.
        updated_at       = excluded.updated_at,
        duration_sec     = excluded.duration_sec,
        thumbnail_url    = excluded.thumbnail_url,
        thumbnail_width  = excluded.thumbnail_width,
        thumbnail_height = excluded.thumbnail_height,
        embed_url        = excluded.embed_url,
        permalink        = excluded.permalink,
        tags             = excluded.tags,
        -- ponytail: views freeze once a clip ages out of the 50-item feed
        -- window; paginate /videos if that matters. GREATEST means a stale
        -- refresh (or a clip that has aged out and reports 0) can never claw
        -- a count back down — the live feed is the fresher truth, but only upward.
        views            = greatest(clips.views, excluded.views)
    `;
    return true;
  });
}

/**
 * Store the Thai rewrite for one reel. Called by POST /api/ingest.
 *
 * Upsert, not insert: n8n retries on any non-2xx, so the same payload can
 * arrive twice. COALESCE on each field means a later call that omits a value
 * keeps the one already stored — a partial retry never erases a good rewrite.
 * Returns false (never throws) so the route can answer 5xx and let n8n retry.
 */
export async function upsertScript(input: ScriptInput): Promise<boolean> {
  return run(`upsertScript(${input.videoId})`, false, async (sql) => {
    await sql`
      insert into clip_scripts (video_id, script_th, article_th, rewritten_title, source_url, source_publisher)
      values (
        ${input.videoId}, ${input.scriptTh ?? null}, ${input.articleTh ?? null},
        ${input.rewrittenTitle ?? null}, ${input.sourceUrl ?? null}, ${input.sourcePublisher ?? null}
      )
      on conflict (video_id) do update set
        script_th        = coalesce(excluded.script_th, clip_scripts.script_th),
        article_th       = coalesce(excluded.article_th, clip_scripts.article_th),
        rewritten_title  = coalesce(excluded.rewritten_title, clip_scripts.rewritten_title),
        source_url       = coalesce(excluded.source_url, clip_scripts.source_url),
        source_publisher = coalesce(excluded.source_publisher, clip_scripts.source_publisher),
        updated_at       = now()
    `;
    return true;
  });
}

// ponytail: list projection duplicated verbatim in getMostViewed — the neon
// tagged template can't interpolate an identifier list. Adding a column that a
// listing renders means adding it to BOTH. Move to a `clips_list` view in
// db/schema.sql if a third list query ever appears.
export async function getStoredClips(limit = DEFAULT_LIMIT): Promise<Clip[]> {
  return run("getStoredClips", [], async (sql) => {
    const rows = await sql`
      select
        slug, id, source, title, category,
        published_at, updated_at, duration_sec,
        thumbnail_url, thumbnail_width, thumbnail_height,
        embed_url, permalink, views, rewritten_title
      from clips_full order by published_at desc limit ${Math.max(0, limit)}
    `;
    return rows.map(toClip);
  });
}

/** Just enough to emit one <url> entry. Two columns, no join. */
export type ClipRef = { slug: string; updatedAt: string };

/**
 * Every archived article, oldest included — the sitemap's row set.
 *
 * Deliberately NOT getStoredClips(): that caps at DEFAULT_LIMIT, so once the
 * table passed 500 rows (Aug 2026, ~75 reels/day) sitemap.xml silently stopped
 * listing anything older and Google loses the URLs it already indexed. This has
 * no limit — it can't, the whole point is completeness.
 *
 * Uncapped rows are only affordable because the projection is two small
 * columns: ~120 bytes a row against ~1KB for a clips_full row, so the full
 * table costs less egress than the capped 500-row read it replaces.
 *
 * ponytail: a sitemap tops out at 50,000 URLs — ~600 days at this publish
 * rate. Split into a sitemap index when that gets close.
 */
export async function getAllClipRefs(): Promise<ClipRef[]> {
  return run("getAllClipRefs", [], async (sql) => {
    const rows = await sql`
      select slug, updated_at from clips
      where source <> 'sample'
      order by published_at desc
    `;
    return rows.map((r) => ({ slug: String(r.slug), updatedAt: iso(r.updated_at) }));
  });
}

/**
 * Top N by view count within the current Bangkok calendar month, ranked in SQL.
 *
 * Not a filter over getStoredClips(): that caps at DEFAULT_LIMIT rows and the
 * Page publishes ~75 reels/day, so 500 rows is ~6.7 days — from the 8th of any
 * month on, an in-memory "this month" ranking would be structurally blind to
 * most of the month.
 *
 * The double `at time zone` is deliberate and verified against the live DB:
 * the inner one turns `now()` (timestamptz) into Bangkok wall-clock time so
 * date_trunc finds the Bangkok month boundary; the outer one reads that naive
 * timestamp back *as* Bangkok local, yielding the absolute instant
 * 2026-08-01 00:00+07 (= 2026-07-31T17:00Z) that compares against published_at.
 * Independent of the server's TimeZone setting, which on Neon is GMT.
 *
 * views > 0 mirrors toClip: 0 means "no count", not "nobody watched".
 */
export async function getMostViewed(n: number): Promise<Clip[]> {
  return run("getMostViewed", [], async (sql) => {
    const rows = await sql`
      select
        slug, id, source, title, category,
        published_at, updated_at, duration_sec,
        thumbnail_url, thumbnail_width, thumbnail_height,
        embed_url, permalink, views, rewritten_title
      from clips_full
      where published_at >= date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
        and views > 0
      order by views desc, published_at desc
      limit ${Math.max(0, n)}
    `;
    return rows.map(toClip);
  });
}

export async function getStoredClipBySlug(slug: string): Promise<Clip | null> {
  return run(`getStoredClipBySlug(${slug})`, null, async (sql) => {
    const rows = await sql`select * from clips_full where slug = ${slug} limit 1`;
    return rows.length > 0 ? toClip(rows[0]) : null;
  });
}

/**
 * The source-article URL n8n sent for one reel, or null.
 *
 * Fallback for lib/providers/source-article.ts, whose primary path reads the
 * Page's own "อ่านเพิ่มเติม" comment off the Graph API. That comment can be
 * missing, edited, or simply out of the 50 the comments edge returns — but n8n
 * knew the URL at publish time and already stored it here, so there is no
 * reason to lose attribution. Returns the raw string; the caller sanitises it
 * the same way it sanitises a URL scraped from a comment.
 */
export async function getStoredSourceUrl(videoId: string): Promise<string | null> {
  return run(`getStoredSourceUrl(${videoId})`, null, async (sql) => {
    const rows = await sql`
      select source_url from clip_scripts where video_id = ${videoId} limit 1
    `;
    const url = rows[0]?.source_url;
    return typeof url === "string" && url.length > 0 ? url : null;
  });
}

/**
 * The archived thumbnail for each of `ids` — how lib/thumb-blob.ts learns
 * which clips already have a Vercel Blob copy. A DB read, not blob `list()`:
 * the URL is already a column here, and this stays inside the same
 * never-throw discipline as everything else in this file.
 */
export async function getStoredThumbs(
  ids: string[],
): Promise<Map<string, { url: string; width: number; height: number }>> {
  if (ids.length === 0) return new Map();
  return run("getStoredThumbs", new Map(), async (sql) => {
    const rows = await sql`
      select id, thumbnail_url, thumbnail_width, thumbnail_height
      from clips where id = any(${ids})
    `;
    return new Map(
      rows.map((r) => [
        String(r.id),
        {
          url: String(r.thumbnail_url),
          width: Number(r.thumbnail_width),
          height: Number(r.thumbnail_height),
        },
      ]),
    );
  });
}

/** Slug for one Facebook video id, or null. Backs the /v/<id> redirect. */
export async function getStoredSlugById(id: string): Promise<string | null> {
  return run(`getStoredSlugById(${id})`, null, async (sql) => {
    const rows = (await sql`select slug from clips where id = ${id} limit 1`) as { slug: string }[];
    return rows[0]?.slug ?? null;
  });
}
