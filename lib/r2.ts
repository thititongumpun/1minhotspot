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
  return publicUrl(key);
}
