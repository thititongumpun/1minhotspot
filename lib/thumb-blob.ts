import { hasR2Credentials, putObject } from "./r2";
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

/**
 * Our own archive host — R2 behind R2_PUBLIC_HOST, plus the retired Vercel
 * Blob host so rows the backfill has not reached yet still count as archived
 * (otherwise archive() would overwrite them with an expiring fbcdn URL).
 * Anything else is still an expiring provider URL.
 */
export function isArchivedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname.endsWith(".public.blob.vercel-storage.com") ||
      (!!process.env.R2_PUBLIC_HOST && hostname === process.env.R2_PUBLIC_HOST)
    );
  } catch {
    return false;
  }
}

/** The listing width. Every grid on the site renders a card at <=640 CSS px on
 *  the widest breakpoint, and the source is a 1080x1920 reel still that
 *  object-cover crops to 16:9 anyway — 640 is the honest ceiling, not a guess. */
const SMALL_WIDTH = 640;

/**
 * The 640px WebP sibling of an archived thumbnail — a NAMING CONVENTION, not a
 * column. blobThumbnails and scripts/blob-thumbs.ts both write the large object
 * at the deterministic key `thumbs/<id>.jpg`, so `thumbs/<id>-640.webp` is
 * recoverable from the URL with no schema change and no widening of the two
 * duplicated list projections in lib/store.ts.
 *
 * Returns the input UNCHANGED for anything that is not an R2 large thumb:
 * retired Vercel Blob rows, un-archived fbcdn rows, and picsum sample clips
 * have no sibling object and must keep rendering their own URL.
 *
 * The trade-off this buys the simplicity with: nothing verifies the sibling
 * exists. scripts/small-thumbs.ts must have finished for every pre-existing R2
 * row BEFORE a build that calls this reaches production, or those cards 404.
 */
export function smallThumbUrl(url: string): string {
  const host = process.env.R2_PUBLIC_HOST;
  if (!host) return url;
  try {
    const u = new URL(url);
    const id = /^\/thumbs\/(.+)\.jpg$/.exec(u.pathname)?.[1];
    return u.hostname === host && id ? `https://${host}/thumbs/${id}-${SMALL_WIDTH}.webp` : url;
  } catch {
    return url;
  }
}

/**
 * Resize one archived still to the listing width and store it beside the large
 * object. Exported so scripts/small-thumbs.ts backfills through exactly this
 * code path — one resize policy, not two that drift.
 *
 * withoutEnlargement: a still narrower than 640 is already small enough, and
 * upscaling invents no detail (same reasoning as fetchLargestStill's note).
 */
export async function putSmallThumb(id: string, source: ArrayBuffer): Promise<void> {
  await putObject(`thumbs/${id}-${SMALL_WIDTH}.webp`, await resizeToWebp(source), "image/webp");
}

/**
 * On Workers the deploy strips sharp's native libvips (see commit 3e21c12), so
 * resize through the Images binding wired in wrangler.jsonc. Everywhere else
 * (scripts/small-thumbs.ts, next dev) that binding is absent and sharp runs.
 */
async function resizeToWebp(source: ArrayBuffer): Promise<ArrayBuffer | Buffer> {
  const images = await workersImages();
  if (images) {
    const out = await images
      .input(new Blob([source]).stream())
      .transform({ width: SMALL_WIDTH, fit: "scale-down" })
      .output({ format: "image/webp", quality: 72 });
    return out.response().arrayBuffer();
  }
  // Specifier kept out of a string literal so esbuild (OpenNext's Cloudflare build) can't
  // statically resolve and inline sharp's native .node binaries into the Workers bundle.
  const sharpPackageName = "sharp";
  const sharp = (await import(sharpPackageName)).default;
  return sharp(Buffer.from(source))
    .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

// Just the slice of Cloudflare's ImagesBinding used above. `wrangler types` would generate the
// real one, but its global Workers runtime types collide with @types/node across the repo.
type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; fit: "scale-down" }): {
      output(options: { format: "image/webp"; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

/** The Images binding when running inside the Worker, else null. */
async function workersImages(): Promise<ImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES ?? null;
  } catch {
    return null; // not on Workers (tsx script, plain next build)
  }
}

/** Only the retired host — what the backfill's --force re-uploads. */
export function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

let warned = false;

/**
 * Re-point clips at an R2 copy of their Facebook still.
 *
 * Never throws: with no blob store, a Graph failure or a failed upload, the
 * clip keeps its (expiring) fbcdn URL — a stale image beats a broken one.
 * Already-uploaded clips are read back from `clips.thumbnail_url`, which is
 * REQUIRED: load()'s merge lets the live feed win on thumbnails, so without
 * this the fbcdn URL would be written back on every render.
 */
export async function blobThumbnails(clips: Clip[]): Promise<Clip[]> {
  // Stored archive URLs win before anything else — including the credential
  // check below. If this ran after it, a missing token would hand archive()
  // the live fbcdn URLs and overwrite every good row in the live window.
  const stored = await getStoredThumbs(clips.map((c) => c.id));
  const kept = clips.map((clip) => {
    const known = stored.get(clip.id);
    return known && isArchivedUrl(known.url) ? { ...clip, thumbnail: known } : clip;
  });

  if (!hasR2Credentials()) {
    if (!warned) {
      warned = true;
      console.warn("[thumb-blob] no R2 credentials — new thumbnails stay on the Facebook CDN.");
    }
    return kept;
  }

  let uploads = 0;
  return Promise.all(
    kept.map(async (clip) => {
      if (isArchivedUrl(clip.thumbnail.url)) return clip;
      // ponytail: no negative cache — a deleted video (empty Graph `format`)
      // re-spends a slot every render. Persist a thumb_failed_at column and
      // skip for 24h if such clips ever crowd out fresh ones.
      if (uploads >= MAX_NEW_UPLOADS) return clip;
      uploads++;
      try {
        const still = await fetchLargestStill(clip.id);
        if (!still) return clip;
        const res = await fetch(still.url);
        if (!res.ok) return clip;
        const bytes = await res.arrayBuffer();
        const url = await putObject(
          `thumbs/${clip.id}.jpg`,
          bytes,
          res.headers.get("content-type") ?? "image/jpeg",
        );
        // Separate try: a sharp failure must never cost us the large upload we
        // just made. A missing small object degrades to a 404 on ONE card;
        // losing the large one means the clip re-spends an upload slot forever.
        try {
          await putSmallThumb(clip.id, bytes);
        } catch (err) {
          console.warn(`[thumb-blob] small ${clip.id}: ${(err as Error).message}`);
        }
        return { ...clip, thumbnail: { url, width: still.width, height: still.height } };
      } catch (err) {
        console.warn(`[thumb-blob] ${clip.id}: ${(err as Error).message}`);
        return clip;
      }
    }),
  );
}
