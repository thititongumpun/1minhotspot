/**
 * Backfill the 640px WebP listing sibling for every clip already on R2.
 *   pnpm exec tsx scripts/small-thumbs.ts                          # dry run, prints what it would resize
 *   pnpm exec tsx scripts/small-thumbs.ts --apply                  # writes the R2 objects
 *   pnpm exec tsx scripts/small-thumbs.ts --apply --skip-existing  # cheap re-run after a partial pass
 *
 * Writes NO database rows. The small URL is derived from the large one by
 * smallThumbUrl(), so there is nothing to store — this script only creates R2
 * objects, and `clips` is never touched.
 *
 * Makes NO Graph call, so FB_ACCESS_TOKEN is NOT required (the visible
 * difference from scripts/blob-thumbs.ts). The large object is already on our
 * own domain and is exactly the source we want to resize; re-fetching from
 * Facebook would burn Graph quota and could hand back a different frame.
 */
import { neon } from "@neondatabase/serverless";
import { putSmallThumb, smallThumbUrl } from "../lib/thumb-blob";
import { hasR2Credentials } from "../lib/r2";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const apply = process.argv.includes("--apply");
const skipExisting = process.argv.includes("--skip-existing");

async function main() {
  const { DATABASE_URL } = process.env;
  // R2 is required even for a dry run: smallThumbUrl() keys off R2_PUBLIC_HOST,
  // so without it every row looks like a non-R2 row and the run is a silent no-op.
  const missing = [
    !DATABASE_URL && "DATABASE_URL",
    !hasR2Credentials() && "R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_HOST",
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
    const small = smallThumbUrl(row.thumbnail_url);
    // Unchanged means it is not an R2 large thumb (retired Blob, fbcdn, picsum
    // sample) — there is no sibling to create.
    if (small === row.thumbnail_url) continue;

    try {
      if (skipExisting) {
        const head = await fetch(small, { method: "HEAD" });
        if (head.ok) continue;
      }

      console.log(`${small}  ${row.slug}`);

      if (apply) {
        const res = await fetch(row.thumbnail_url);
        if (!res.ok) {
          console.warn(`skip ${row.slug}: fetch ${res.status}`);
          continue;
        }
        await putSmallThumb(row.id, await res.arrayBuffer());
      }

      n++;
    } catch (err) {
      // A thrown network/upload error must never crash the batch; the large
      // object is untouched either way.
      console.warn(`skip ${row.slug}: ${(err as Error).message}`);
    }
  }

  console.log(`${apply ? "updated" : "would update"} ${n}/${rows.length} rows`);
}

main();
