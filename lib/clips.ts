import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { CategorySlug, Clip } from "./types";
import { fetchFacebookClips, fetchFacebookVideo } from "./providers/facebook";
import { fetchYouTubeClips } from "./providers/youtube";
import { getSourceArticle } from "./providers/source-article";
import { sampleClips } from "./sample-clips";
import { hasDb } from "./db";
import { getMostViewed, getStoredClipBySlug, getStoredClips, upsertClip } from "./store";
import { blobThumbnails } from "./thumb-blob";

const byNewest = (a: Clip, b: Clip) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

/** Sample clips are invented stories. Anything that publishes must be able to see that. */
const SAMPLE_ALARM =
  "[clips] SERVING SAMPLE DATA — these stories are FABRICATED and must NOT be published, " +
  "indexed or submitted to Google as news. Set FB_PAGE_ID + FB_ACCESS_TOKEN (or YT_API_KEY + " +
  "YT_CHANNEL_ID) before deploying.";

/**
 * Provider selection: Facebook → YouTube → sample data.
 * Never throws: any provider failure logs and falls back to samples, so the site
 * builds and renders green with zero credentials present.
 */
async function fetchLive(): Promise<Clip[]> {
  try {
    if (process.env.FB_PAGE_ID && process.env.FB_ACCESS_TOKEN) {
      const clips = await fetchFacebookClips();
      if (clips.length > 0) return clips;
      console.error("[clips] Facebook returned no reel-length videos.");
    } else if (process.env.YT_API_KEY && process.env.YT_CHANNEL_ID) {
      const clips = await fetchYouTubeClips();
      if (clips.length > 0) return clips;
      console.error("[clips] YouTube returned no reel-length videos.");
    }
  } catch (err) {
    console.error("[clips] provider failed:", (err as Error).message);
  }
  console.error(SAMPLE_ALARM);
  return sampleClips;
}

/**
 * Write the live window to the store. The Graph /videos edge reaches only ~16h
 * back and nothing follows `paging.next`, so a clip that is not archived while
 * it is still visible is gone for good — and its article URL starts 404ing.
 * upsertClip never throws, so a broken database degrades to "no archiving",
 * never to a broken page.
 */
async function archive(clips: Clip[]): Promise<void> {
  if (!hasDb()) return; // hasDb first: otherwise this logs one warning per clip
  const results = await Promise.all(clips.map((c) => upsertClip(c)));
  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) console.warn(`[clips] archive: ${failed}/${clips.length} clips not stored.`);
}

/**
 * The live feed unioned with the durable store, so article URLs outlive the
 * ~16h Facebook window. Reads the store BEFORE archiving; the merge below picks
 * the freshly-fetched clips up anyway.
 */
async function loadUncached(): Promise<Clip[]> {
  const live = await fetchLive();

  // Sample clips are fabricated. Never archive them, and never union them with
  // real stored clips — a page must not mix invented stories into real ones.
  if (live === sampleClips) {
    const stored = await getStoredClips();
    return stored.length > 0 ? stored : live;
  }

  // Archive BEFORE reading back. n8n POSTs a reel's Thai rewrite the moment it
  // publishes, which is up to an hour before this code first sees that reel.
  // Writing the clip and then reading through clips_full is what folds the
  // waiting rewrite in on the very first revalidate, instead of the second.
  // Swap the expiring fbcdn stills for own-domain Blob copies BEFORE
  // archiving, so the durable URL is what gets written and what the merge
  // below re-applies over the stored row.
  const blobbed = await blobThumbnails(live);
  await archive(blobbed);
  const stored = await getStoredClips();
  if (stored.length === 0) return blobbed;

  const bySlug = new Map(stored.map((c) => [c.slug, c]));
  for (const c of blobbed) {
    const s = bySlug.get(c.slug);
    // Stored wins on text — it carries the n8n Thai rewrite. Live wins on the
    // Facebook CDN urls, which are signed and expire.
    bySlug.set(c.slug, s ? { ...s, thumbnail: c.thumbnail, embedUrl: c.embedUrl } : c);
  }
  return [...bySlug.values()];
}

// Data Cache for an hour, site-wide. React's cache() only dedupes within one
// request, so every ISR regeneration of every route (828 article slugs, hourly,
// under crawler load) re-pulled the 500-row list (~350 kB) and re-upserted the
// live window — ~500 MB/day of Neon egress against a 12 MB database.
const load = cache(unstable_cache(loadUncached, ["clips-load"], { revalidate: 3600, tags: ["clips"] }));

/**
 * Archive one reel that the hourly feed has not seen yet. /v/<id> calls this
 * when both the store and the (cached) feed miss: n8n comments that URL
 * seconds after publish, up to an hour before load() next fetches the feed.
 * Same pipeline as load() — R2 still first, then upsert — so the row written
 * here is byte-for-byte what the feed would have written, and the later feed
 * archive hits the same slug instead of creating a second row.
 */
export async function archiveFreshClip(id: string): Promise<Clip | null> {
  const clip = await fetchFacebookVideo(id);
  if (!clip) return null;
  const [blobbed] = await blobThumbnails([clip]);
  await archive([blobbed]);
  return blobbed;
}

/** The only data entry point pages use. Newest first. */
export async function getClips(): Promise<Clip[]> {
  return [...(await load())].sort(byNewest);
}

export const getClip = cache(async (slug: string): Promise<Clip | null> => {
  // Next hands dynamic route params through percent-encoded, so a Thai slug
  // arrives as "%E0%B9%80..." and never matches the decoded clip.slug.
  let wanted = slug;
  try {
    wanted = decodeURIComponent(slug);
  } catch {
    // Malformed escape sequence — match on the raw string and let it 404.
  }
  // load() is capped (getStoredClips has a limit), so a deep-archive slug can
  // miss it. Hitting the store by slug is what guarantees an old URL still 200s
  // — the whole point of persisting clips.
  // load() rows are the trimmed list projection (lib/store.ts) — no body,
  // summary or tags. The article page needs all three, so the store row is
  // authoritative here; load() only contributes the live signed CDN urls.
  const listed = (await load()).find((c) => c.slug === wanted);
  const stored = await getStoredClipBySlug(wanted);
  const clip =
    stored && listed
      ? { ...stored, thumbnail: listed.thumbnail, embedUrl: listed.embedUrl }
      : (stored ?? listed);
  if (!clip || clip.source !== "facebook") return clip ?? null;
  // Lazy on purpose: only the article page needs a body, and resolving one
  // costs a Graph call plus a hit on a publisher we do not own. Doing this in
  // load() would put 50 extra round trips behind every listing page render.
  const sourceArticle = await getSourceArticle(clip.id);
  return sourceArticle ? { ...clip, sourceArticle } : clip;
});

export async function getClipsByCategory(cat: CategorySlug): Promise<Clip[]> {
  return (await getClips()).filter((c) => c.category === cat);
}

export async function getLatest(n: number): Promise<Clip[]> {
  return (await getClips()).slice(0, Math.max(0, n));
}

/** Bangkok Y/M via Intl, same pattern as components/format.ts `formatDate` — the
 *  host may run in UTC (or anywhere), so the month boundary can't be derived
 *  from the host's own local clock. */
const bangkokYearMonth = (d: Date): { year: string; month: string } => {
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
 * Filter+sort only, split out from getMostViewedThisMonth so the Bangkok-month
 * boundary math is testable without a live/sample data round trip through
 * getClips(). `now` is a param (not `new Date()` inline) for the same reason.
 */
export function pickMostViewedThisMonth(clips: Clip[], n: number, now: Date): Clip[] {
  const { year, month } = bangkokYearMonth(now);
  const monthStart = Date.parse(`${year}-${month}-01T00:00:00+07:00`);

  return clips
    .filter(
      (c) =>
        Date.parse(c.publishedAt) >= monthStart &&
        typeof c.views === "number" &&
        Number.isFinite(c.views) &&
        c.views > 0,
    )
    .sort((a, b) => (b.views as number) - (a.views as number) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, Math.max(0, n));
}

/**
 * Top N Facebook clips by view count within the current Bangkok calendar
 * month. Bangkok is a fixed UTC+7 with no DST, so the ISO string built inside
 * pickMostViewedThisMonth is exact — no library needed for what's a one-line
 * offset.
 *
 * The DB path is the real one: getClips() is capped at DEFAULT_LIMIT rows
 * (~6.7 days at this Page's publish rate), so ranking it in memory can only
 * ever see the tail of the month. getClips() is still awaited first — it is
 * what archives the live window, so the ranking runs after today's views land
 * — and its result is the no-database fallback.
 */
export async function getMostViewedThisMonth(n = 5): Promise<Clip[]> {
  const clips = await getClips();
  if (hasDb()) {
    const ranked = await getMostViewed(n);
    if (ranked.length > 0) return ranked;
  }
  return pickMostViewedThisMonth(clips, n, new Date());
}

export async function getLeadAndRundown(): Promise<{
  lead: Clip;
  subs: Clip[];
  rundown: Clip[];
}> {
  const clips = await getClips();
  const lead = clips[0];
  // getClips() always has >=1 element today (sample data is the hard-coded
  // last resort, never empty) but the return type promises a Clip, not
  // Clip|undefined — fail loudly here rather than hand the home page a
  // `lead: undefined` it isn't typed to expect.
  if (!lead) throw new Error("getLeadAndRundown: no clips available");
  // subs sit under the lead in the same column: the lead is a fixed 16:9 and
  // the 8-row rundown beside it is roughly twice as tall, so without them the
  // left column ends in a void. They rank above the rundown — clips 2 and 3.
  return { lead, subs: clips.slice(1, 3), rundown: clips.slice(3, 11) };
}
