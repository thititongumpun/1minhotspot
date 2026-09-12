/**
 * Re-point archived clips at R2 copies of their Facebook still.
 *   pnpm exec tsx scripts/blob-thumbs.ts                   # dry run, prints the diff
 *   pnpm exec tsx scripts/blob-thumbs.ts --apply           # writes fbcdn rows
 *   pnpm exec tsx scripts/blob-thumbs.ts --apply --force   # also re-uploads retired Vercel Blob rows
 *
 * Rows on fbcdn expire (`oe=` signature) after ~6 days; rows on the retired
 * Vercel Blob store go dark when that store is paused. Both are re-fetched
 * from Graph, never from the old store. New ingests go through blobThumbnails.
 */
import { fetchLargestStill, isArchivedUrl, isVercelBlobUrl } from "../lib/thumb-blob";
import { hasR2Credentials, putObject } from "../lib/r2";
import { d1, lit } from "./_d1";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

async function main() {
  const { FB_ACCESS_TOKEN } = process.env;
  const missing = [
    !FB_ACCESS_TOKEN && "FB_ACCESS_TOKEN",
    apply && !hasR2Credentials() && "R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_HOST",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Need ${missing.join(", ")} in .env.local.`);
    process.exit(1);
  }

  const rows = d1<{ id: string; slug: string; thumbnail_url: string }>(
    "select id, slug, thumbnail_url from clips order by published_at desc",
  );

  let n = 0;

  // ponytail: sequential, ~520 rows takes minutes; add a small pool if it's ever re-run at 10x the size.
  for (const row of rows) {
    if (isArchivedUrl(row.thumbnail_url) && !(force && isVercelBlobUrl(row.thumbnail_url))) continue;

    try {
      const still = await fetchLargestStill(row.id);
      if (!still) {
        console.warn(`skip ${row.slug}: no format`);
        continue;
      }

      const res = await fetch(still.url);
      if (!res.ok) {
        console.warn(`skip ${row.slug}: fetch ${res.status}`);
        continue;
      }

      console.log(`${still.width}x${still.height}  ${row.slug}`);

      if (apply) {
        const url = await putObject(
          `thumbs/${row.id}.jpg`,
          await res.arrayBuffer(),
          res.headers.get("content-type") ?? "image/jpeg",
        );
        d1(
          `update clips set thumbnail_url = ${lit(url)}, thumbnail_width = ${lit(still.width)},
             thumbnail_height = ${lit(still.height)} where id = ${lit(row.id)}`,
        );
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
