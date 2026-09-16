import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 via its S3 API, signed by aws4fetch (SigV4 over fetch — no AWS SDK).
 * Public reads go through the bucket's custom domain (R2_PUBLIC_HOST), so
 * the returned URL never carries credentials or expiry.
 */

export function hasR2Credentials(): boolean {
  const e = process.env;
  return Boolean(
    e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.R2_PUBLIC_HOST,
  );
}

/** Where a key is read from. Throws only when R2_PUBLIC_HOST is unset. */
export function publicUrl(key: string): string {
  const host = process.env.R2_PUBLIC_HOST;
  if (!host) throw new Error("R2_PUBLIC_HOST is unset");
  return `https://${host}/${key}`;
}

export function hasCachePurgeCredentials(): boolean {
  const e = process.env;
  return Boolean(e.CLOUDFLARE_CACHE_PURGE_TOKEN && e.CLOUDFLARE_ZONE_ID);
}

let warnedPurge = false;

/**
 * Best-effort purge of Cloudflare's edge cache for a freshly (re)written R2
 * object. The immutable, 1-year cache-control on every object (below) is
 * correct for a key that never changes, but it is exactly what makes the
 * self-heal path in thumb-blob.ts invisible at the edge: overwriting
 * `thumbs/<id>.jpg` in R2 does nothing to whatever the CDN already cached
 * for that URL, so without this every self-heal would silently keep serving
 * the old (broken) bytes until someone manually purges.
 *
 * A dedicated token, not the CLOUDFLARE_API_TOKEN already used by Workers
 * Builds for wrangler/D1 access: that one is Account-scoped, this needs
 * Zone > Cache Purge on the zone serving R2_PUBLIC_HOST — reusing the name
 * would silently 403 the moment someone points CLOUDFLARE_ZONE_ID at it.
 *
 * Never throws: a skipped or failed purge means the edge serves a stale
 * copy for a while longer, not a broken upload — the write already
 * succeeded, and that must never be undone by a purge failure. A hung
 * api.cloudflare.com would otherwise block every putObject() call — and
 * therefore every page prerender through blobThumbnails() — so it's capped
 * at 5s.
 */
export async function purgeCache(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const { CLOUDFLARE_CACHE_PURGE_TOKEN, CLOUDFLARE_ZONE_ID } = process.env;
  if (!hasCachePurgeCredentials()) {
    if (!warnedPurge) {
      warnedPurge = true;
      console.warn(
        "[r2] no CLOUDFLARE_CACHE_PURGE_TOKEN/CLOUDFLARE_ZONE_ID — overwritten objects stay cached at the edge until purged manually.",
      );
    }
    return;
  }
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CLOUDFLARE_CACHE_PURGE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: urls }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[r2] cache purge ${res.status}: ${await res.text().catch(() => "")}`);
  } catch (err) {
    console.warn(`[r2] cache purge: ${(err as Error).message}`);
  }
}

let client: AwsClient | undefined;

/**
 * Upload one object and return its public URL. `body` is a buffer, not a
 * stream: R2 rejects unknown-length PUTs, and a thumbnail is ~200KB.
 */
export async function putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!hasR2Credentials()) throw new Error("R2 credentials missing");
  client ??= new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  // Accept the bare 32-hex id or the whole S3 endpoint URL pasted from the dashboard.
  const accountId = /[0-9a-f]{32}/.exec(R2_ACCOUNT_ID!)?.[0] ?? R2_ACCOUNT_ID;
  const res = await client.fetch(
    `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`,
    {
      method: "PUT",
      // Cast: BodyInit rejects Uint8Array<ArrayBufferLike> because the buffer
      // *could* be a SharedArrayBuffer. sharp's Buffer never is, and fetch
      // accepts both branches of the union at runtime.
      body: body as BodyInit,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        // R2 stores this and serves it back on the custom domain.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
  if (!res.ok) throw new Error(`R2 put ${key}: ${res.status} ${await res.text().catch(() => "")}`);
  const url = publicUrl(key);
  await purgeCache([url]);
  return url;
}
