import { cache } from "react";
import type { CategorySlug, Clip } from "./types";
import { fetchFacebookClips } from "./providers/facebook";
import { fetchYouTubeClips } from "./providers/youtube";
import { getSourceArticle } from "./providers/source-article";
import { sampleClips } from "./sample-clips";
import { hasDb } from "./db";
import { getStoredClipBySlug, getStoredClips, upsertClip } from "./store";

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
const load = cache(async (): Promise<Clip[]> => {
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
  await archive(live);
  const stored = await getStoredClips();
  if (stored.length === 0) return live;

  const bySlug = new Map(stored.map((c) => [c.slug, c]));
  for (const c of live) {
    const s = bySlug.get(c.slug);
    // Stored wins on text — it carries the n8n Thai rewrite. Live wins on the
    // Facebook CDN urls, which are signed and expire.
    bySlug.set(c.slug, s ? { ...s, thumbnail: c.thumbnail, embedUrl: c.embedUrl } : c);
  }
  return [...bySlug.values()];
});

/** The only data entry point pages use. Newest first. */
export async function getClips(): Promise<Clip[]> {
  return [...(await load())].sort(byNewest);
}

export async function getClip(slug: string): Promise<Clip | null> {
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
  const clip =
    (await load()).find((c) => c.slug === wanted) ?? (await getStoredClipBySlug(wanted));
  if (!clip || clip.source !== "facebook") return clip;
  // Lazy on purpose: only the article page needs a body, and resolving one
  // costs a Graph call plus a hit on a publisher we do not own. Doing this in
  // load() would put 50 extra round trips behind every listing page render.
  const sourceArticle = await getSourceArticle(clip.id);
  return sourceArticle ? { ...clip, sourceArticle } : clip;
}

export async function getClipsByCategory(cat: CategorySlug): Promise<Clip[]> {
  return (await getClips()).filter((c) => c.category === cat);
}

export async function getLatest(n: number): Promise<Clip[]> {
  return (await getClips()).slice(0, Math.max(0, n));
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
