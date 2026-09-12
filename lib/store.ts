import { getDb, type D1 } from "./db";
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

/** Timestamps are stored as UTC ISO text; stay tolerant of a Date anyway. */
const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();

/** `tags` is a JSON array in a text column; anything else (null, bad import) → []. */
const tagsOf = (v: unknown): string[] => {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/** Bangkok Y/M via Intl, same pattern as components/format.ts `formatDate` — the
 *  host may run in UTC (or anywhere), so the month boundary can't be derived
 *  from the host's own local clock. */
export const bangkokYearMonth = (d: Date): { year: string; month: string } => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return { year, month };
};

/**
 * First instant of the current Bangkok calendar month as a UTC ISO string —
 * the same shape as every stored `published_at`, so `>=` compares correctly in
 * SQL. Bangkok is a fixed UTC+7 with no DST, so the literal offset is exact.
 */
export const bangkokMonthStartIso = (now: Date): string => {
  const { year, month } = bangkokYearMonth(now);
  return new Date(`${year}-${month}-01T00:00:00+07:00`).toISOString();
};

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
  // Kept beside the coalesce above, so the two can never disagree. List rows
  // carry the SQL-computed `has_script` instead of the texts: the news sitemap
  // gates on it, and the texts are too heavy to ship on every listing.
  hasScript: Boolean(r.article_th || r.script_th || r.has_script),
  // The narration is the transcript whichever text is the body; when there is
  // no written article the two are the same string, as before.
  ...(r.script_th ? { transcript: r.script_th as string } : {}),
  category: r.category as CategorySlug,
  publishedAt: iso(r.published_at),
  // max(clip, script): the clip row moves when Facebook edits the video, the
  // script row moves when n8n rewrites the body. Both are real modifications.
  // `script_updated_at` only arrives via getStoredClipBySlug's `select *` —
  // the article page is the one place dateModified is emitted. LIST_COLUMNS is
  // deliberately not widened: list rows read the clip timestamp alone.
  updatedAt: iso(
    r.script_updated_at && Date.parse(iso(r.script_updated_at)) > Date.parse(iso(r.updated_at))
      ? r.script_updated_at
      : r.updated_at,
  ),
  durationSec: Number(r.duration_sec),
  thumbnail: {
    url: String(r.thumbnail_url),
    width: Number(r.thumbnail_width),
    height: Number(r.thumbnail_height),
  },
  embedUrl: String(r.embed_url),
  permalink: String(r.permalink),
  tags: tagsOf(r.tags),
  // 0 and "no count" are different facts (see Clip.views) — only surface a
  // real, positive count, never a fabricated 0 for a clip that never had one.
  views: Number(r.views) > 0 ? Number(r.views) : undefined,
  // Only `select *` (getStoredClipBySlug) carries these; the list projections
  // leave them undefined, which is exactly what the cards expect.
  likes: Number(r.likes) > 0 ? Number(r.likes) : undefined,
  comments: Number(r.comments) > 0 ? Number(r.comments) : undefined,
});

/**
 * Never-throw wrapper, matching the discipline in lib/clips.ts: with no `DB`
 * binding (tsx script, plain next build), or on any query failure, log and
 * return the fallback. The site must build and serve from the live Facebook
 * feed with no database at all.
 */
async function run<T>(label: string, fallback: T, fn: (db: D1) => Promise<T>): Promise<T> {
  const db = await getDb();
  if (!db) {
    console.warn(`[store] ${label}: no DB binding — skipping.`);
    return fallback;
  }
  try {
    return await fn(db);
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
  return run(`upsertClip(${clip.slug})`, false, async (db) => {
    await db
      .prepare(
        `insert into clips (
          slug, id, source, title, summary, body, category,
          published_at, updated_at, duration_sec,
          thumbnail_url, thumbnail_width, thumbnail_height,
          embed_url, permalink, tags, views, likes, comments
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict (slug) do update set
          id               = excluded.id,
          source           = excluded.source,
          title            = excluded.title,
          summary          = excluded.summary,
          body             = excluded.body,
          category         = excluded.category,
          -- published_at intentionally absent: the first publish time is the truth.
          -- Facebook's updated_time bumps on engagement, not edits, so writing it
          -- through unconditionally churned dateModified hourly on every article.
          -- SQLite (like Postgres) evaluates every clips.* reference in an ON
          -- CONFLICT SET against the PRE-update row regardless of assignment
          -- order, so these comparisons are safe even though title/body/summary
          -- are assigned above. IS NOT is SQLite's null-safe inequality.
          updated_at       = case
                               when clips.title   is not excluded.title
                                 or clips.body    is not excluded.body
                                 or clips.summary is not excluded.summary
                               then excluded.updated_at
                               else clips.updated_at
                             end,
          duration_sec     = excluded.duration_sec,
          thumbnail_url    = excluded.thumbnail_url,
          thumbnail_width  = excluded.thumbnail_width,
          thumbnail_height = excluded.thumbnail_height,
          embed_url        = excluded.embed_url,
          permalink        = excluded.permalink,
          tags             = excluded.tags,
          -- ponytail: views freeze once a clip ages out of the 50-item feed
          -- window; paginate /videos if that matters. Two-arg max() (scalar in
          -- SQLite) means a stale refresh (or a clip that has aged out and
          -- reports 0) can never claw a count back down — the live feed is the
          -- fresher truth, but only upward.
          views            = max(clips.views, excluded.views),
          likes            = max(clips.likes, excluded.likes),
          comments         = max(clips.comments, excluded.comments)`,
      )
      .bind(
        clip.slug, clip.id, clip.source, clip.title, clip.summary,
        clip.body, clip.category,
        clip.publishedAt, clip.updatedAt, clip.durationSec,
        clip.thumbnail.url, clip.thumbnail.width, clip.thumbnail.height,
        clip.embedUrl, clip.permalink, JSON.stringify(clip.tags), clip.views ?? 0,
        clip.likes ?? 0, clip.comments ?? 0,
      )
      .run();
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
  return run(`upsertScript(${input.videoId})`, false, async (db) => {
    await db
      .prepare(
        `insert into clip_scripts (video_id, script_th, article_th, rewritten_title, source_url, source_publisher)
        values (?, ?, ?, ?, ?, ?)
        on conflict (video_id) do update set
          script_th        = coalesce(excluded.script_th, clip_scripts.script_th),
          article_th       = coalesce(excluded.article_th, clip_scripts.article_th),
          rewritten_title  = coalesce(excluded.rewritten_title, clip_scripts.rewritten_title),
          source_url       = coalesce(excluded.source_url, clip_scripts.source_url),
          source_publisher = coalesce(excluded.source_publisher, clip_scripts.source_publisher),
          updated_at       = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      )
      .bind(
        input.videoId, input.scriptTh ?? null, input.articleTh ?? null,
        input.rewrittenTitle ?? null, input.sourceUrl ?? null, input.sourcePublisher ?? null,
      )
      .run();
    return true;
  });
}

// ponytail: list projection shared by getStoredClips and getMostViewed via this
// one constant; identifiers can't be bound, so it is spliced into the SQL text.
// Adding a column that a listing renders means adding it here. Move to a
// `clips_list` view in db/migrations if a third list query ever appears.
const LIST_COLUMNS = `
  slug, id, source, title, category,
  published_at, updated_at, duration_sec,
  thumbnail_url, thumbnail_width, thumbnail_height,
  embed_url, permalink, views, rewritten_title,
  (coalesce(article_th, '') <> '' or coalesce(script_th, '') <> '') as has_script`;

export async function getStoredClips(limit = DEFAULT_LIMIT): Promise<Clip[]> {
  return run("getStoredClips", [], async (db) => {
    const { results } = await db
      .prepare(`select ${LIST_COLUMNS} from clips_full order by published_at desc limit ?`)
      .bind(Math.max(0, limit))
      .all();
    return results.map(toClip);
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
  return run("getAllClipRefs", [], async (db) => {
    const { results } = await db
      .prepare(`select slug, updated_at from clips where source <> 'sample' order by published_at desc`)
      .all();
    return results.map((r) => ({ slug: String(r.slug), updatedAt: iso(r.updated_at) }));
  });
}

/**
 * Newest `updated_at` per category — the sitemap's five category <lastmod>
 * values, which were all `new Date()` (a request-time stamp is not a real
 * modification date, and Google discards lastmod site-wide once it sees
 * unreliable ones — including the accurate article dates).
 *
 * A `group by`, not a widened getAllClipRefs(): five rows off the existing
 * clips_category_published_at_idx beats carrying a category column through an
 * uncapped whole-table read.
 */
export async function getCategoryLastMod(): Promise<Map<CategorySlug, string>> {
  return run("getCategoryLastMod", new Map<CategorySlug, string>(), async (db) => {
    const { results } = await db
      .prepare(`select category, max(updated_at) as last_mod from clips where source <> 'sample' group by category`)
      .all();
    return new Map(results.map((r) => [r.category as CategorySlug, iso(r.last_mod)]));
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
 * The month boundary is computed in JS (bangkokMonthStartIso) and bound as a
 * UTC ISO string, the same shape every stored published_at has, so the `>=` is
 * a plain text compare. Independent of the host clock's zone. `now` is a param
 * so the boundary math is testable.
 *
 * views > 0 mirrors toClip: 0 means "no count", not "nobody watched".
 */
export async function getMostViewed(n: number, now = new Date()): Promise<Clip[]> {
  return run("getMostViewed", [], async (db) => {
    const { results } = await db
      .prepare(
        `select ${LIST_COLUMNS} from clips_full
        where published_at >= ? and views > 0
        order by views desc, published_at desc
        limit ?`,
      )
      .bind(bangkokMonthStartIso(now), Math.max(0, n))
      .all();
    return results.map(toClip);
  });
}

export async function getStoredClipBySlug(slug: string): Promise<Clip | null> {
  return run(`getStoredClipBySlug(${slug})`, null, async (db) => {
    const row = await db.prepare(`select * from clips_full where slug = ? limit 1`).bind(slug).first();
    return row ? toClip(row) : null;
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
  return run(`getStoredSourceUrl(${videoId})`, null, async (db) => {
    const row = await db
      .prepare(`select source_url from clip_scripts where video_id = ? limit 1`)
      .bind(videoId)
      .first();
    const url = row?.source_url;
    return typeof url === "string" && url.length > 0 ? url : null;
  });
}

/**
 * The archived thumbnail for each of `ids` — how lib/thumb-blob.ts learns
 * which clips already have a Vercel Blob copy. A DB read, not blob `list()`:
 * the URL is already a column here, and this stays inside the same
 * never-throw discipline as everything else in this file.
 *
 * Chunked by 90: D1 caps a statement at 100 bound parameters. Called with the
 * ≤50-clip live window today, so this is one query in practice.
 */
export async function getStoredThumbs(
  ids: string[],
): Promise<Map<string, { url: string; width: number; height: number }>> {
  if (ids.length === 0) return new Map();
  return run("getStoredThumbs", new Map(), async (db) => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      const { results } = await db
        .prepare(
          `select id, thumbnail_url, thumbnail_width, thumbnail_height
          from clips where id in (${chunk.map(() => "?").join(",")})`,
        )
        .bind(...chunk)
        .all();
      rows.push(...results);
    }
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
export async function getStoredRefById(
  id: string,
): Promise<{ slug: string; category: CategorySlug } | null> {
  return run(`getStoredRefById(${id})`, null, async (db) => {
    return db
      .prepare(`select slug, category from clips where id = ? limit 1`)
      .bind(id)
      .first<{ slug: string; category: CategorySlug }>();
  });
}
