import { put } from "@vercel/blob";
import type { Clip } from "./types";
import { getStoredThumbs } from "./store";

/** Graph `format` entry — same shape lib/providers/facebook.ts reads. */
type GraphFormat = { filter?: string; picture?: string; width?: number; height?: number };

type Thumb = { url: string; width: number; height: number };

// ponytail: 8 uploads/pass so a cold store can't blow the render budget; scripts/blob-thumbs.ts is the bulk path.
// Measured ceiling: blobThumbnails runs once per rendered page, and `pnpm build` prerenders
// 220 pages across 19 workers — on a COLD store every worker reads getStoredThumbs before
// any writes land, so up to 19x8 identical Graph/fbcdn/put round-trips can fire for the same
// 8 clips (harmless — deterministic thumbs/<id>.jpg + allowOverwrite — but a Facebook Graph
// rate-limit hazard that would also stall fetchFacebookClips). Operational rule: run
// `scripts/blob-thumbs.ts --apply` to warm the DB BEFORE the first deploy with the token, so
// the cap is never hit at build time.
const MAX_NEW_UPLOADS = 8;

/**
 * The LARGEST usable `format` still — the deliberate opposite of
 * `pickFormat` in lib/providers/facebook.ts, which picks the smallest one
 * wide enough to render (bytes on the wire). Here the still is uploaded once
 * and served from our own domain, so bigger is strictly better.
 */
export function largestFormat(formats: GraphFormat[] | undefined): Thumb | null {
  const pick = (formats ?? [])
    .filter((f): f is GraphFormat & { picture: string; width: number; height: number } =>
      Boolean(f.picture && f.width && f.height),
    )
    .sort((a, b) => b.width - a.width)[0];
  return pick ? { url: pick.picture, width: pick.width, height: pick.height } : null;
}

// ponytail: stores FB's native 1080x1920 — the largest still Graph has. Discover wants >=1200px wide; no upscaler here (sharp is not a direct dep and upscaling invents no detail).
export async function fetchLargestStill(videoId: string): Promise<Thumb | null> {
  const token = process.env.FB_ACCESS_TOKEN;
  if (!token) return null;
  const version = process.env.FB_API_VERSION || "v26.0";
  const res = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(videoId)}` +
      `?fields=format&access_token=${encodeURIComponent(token)}`,
  );
  const json = (await res.json().catch(() => ({}))) as {
    format?: GraphFormat[];
    error?: { message?: string };
  };
  if (json.error || !json.format) return null;
  return largestFormat(json.format);
}

/** Blob's public read host. Anything else is still an expiring provider URL. */
export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

let warned = false;

/**
 * Re-point clips at a Vercel Blob copy of their Facebook still.
 *
 * Never throws: with no blob store, a Graph failure or a failed upload, the
 * clip keeps its (expiring) fbcdn URL — a stale image beats a broken one.
 * Already-uploaded clips are read back from `clips.thumbnail_url`, which is
 * REQUIRED: load()'s merge lets the live feed win on thumbnails, so without
 * this the fbcdn URL would be written back on every render.
 */
export async function blobThumbnails(clips: Clip[]): Promise<Clip[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (!warned) {
      warned = true;
      console.warn("[thumb-blob] BLOB_READ_WRITE_TOKEN unset — thumbnails stay on the Facebook CDN.");
    }
    return clips;
  }

  const stored = await getStoredThumbs(clips.map((c) => c.id));
  let uploads = 0;

  return Promise.all(
    clips.map(async (clip) => {
      const known = stored.get(clip.id);
      if (known && isBlobUrl(known.url)) return { ...clip, thumbnail: known };
      if (uploads >= MAX_NEW_UPLOADS) return clip;
      uploads++;
      try {
        // ponytail: a clip whose Graph `format` is empty (deleted video) never gets a blob
        // URL, so it re-consumes an upload slot + 3 round-trips on every render, indefinitely.
        // Not worth negative-caching while most clips succeed; upgrade path if deleted videos
        // ever crowd out fresh ones: persist a `thumb_failed_at` column and skip for 24h.
        const still = await fetchLargestStill(clip.id);
        if (!still) return clip;
        const res = await fetch(still.url);
        if (!res.ok || !res.body) return clip;
        const { url } = await put(`thumbs/${clip.id}.jpg`, res.body, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: res.headers.get("content-type") ?? "image/jpeg",
          cacheControlMaxAge: 31536000,
        });
        return { ...clip, thumbnail: { url, width: still.width, height: still.height } };
      } catch (err) {
        console.warn(`[thumb-blob] ${clip.id}: ${(err as Error).message}`);
        return clip;
      }
    }),
  );
}
