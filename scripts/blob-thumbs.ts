/**
 * Re-point archived clips at Vercel Blob copies of their Facebook still.
 *   pnpm exec tsx scripts/blob-thumbs.ts           # dry run, prints the diff
 *   pnpm exec tsx scripts/blob-thumbs.ts --apply   # writes
 *
 * The ~520 rows written before lib/thumb-blob.ts started uploading thumbnails
 * still point at fbcdn URLs, which expire (`oe=` signature) after ~6 days.
 * This is the one-off backfill; new ingests already go through blobThumbnails.
 */
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { fetchLargestStill, isBlobUrl } from "../lib/thumb-blob";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const apply = process.argv.includes("--apply");

async function main() {
  const { DATABASE_URL, FB_ACCESS_TOKEN, BLOB_READ_WRITE_TOKEN } = process.env;
  const missing = [
    !DATABASE_URL && "DATABASE_URL",
    !FB_ACCESS_TOKEN && "FB_ACCESS_TOKEN",
    apply && !BLOB_READ_WRITE_TOKEN && "BLOB_READ_WRITE_TOKEN",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Need ${missing.join(", ")} in .env.local.`);
    process.exit(1);
  }

  const sql = neon(DATABASE_URL!);
  const rows = (await sql`
    select id, slug, thumbnail_url from clips order by published_at desc
  `) as { id: string; slug: string; thumbnail_url: string }[];

  let n = 0;

  // ponytail: sequential, ~520 rows takes minutes; add a small pool if it's ever re-run at 10x the size.
  for (const row of rows) {
    if (isBlobUrl(row.thumbnail_url)) continue;

    try {
      const still = await fetchLargestStill(row.id);
      if (!still) {
        console.warn(`skip ${row.slug}: no format`);
        continue;
      }

      const res = await fetch(still.url);
      if (!res.ok || !res.body) {
        console.warn(`skip ${row.slug}: fetch ${res.status}`);
        continue;
      }

      console.log(`${still.width}x${still.height}  ${row.slug}`);

      if (apply) {
        const { url } = await put(`thumbs/${row.id}.jpg`, res.body, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: res.headers.get("content-type") ?? "image/jpeg",
          cacheControlMaxAge: 31536000,
        });
        await sql`
          update clips
             set thumbnail_url = ${url},
                 thumbnail_width = ${still.width},
                 thumbnail_height = ${still.height}
           where id = ${row.id}
        `;
      }

      n++;
    } catch (err) {
      // A thrown network/upload error must never crash the batch or touch the row's existing URL.
      console.warn(`skip ${row.slug}: ${(err as Error).message}`);
    }
  }

  console.log(`${apply ? "updated" : "would update"} ${n}/${rows.length} rows`);
}

main();
