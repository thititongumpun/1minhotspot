/**
 * One-off repair for rows whose R2 large object is fbcdn's 160x120 GIF
 * placeholder (archived seconds after publish, before the still existed).
 *   pnpm exec tsx scripts/repair-placeholders.ts            # dry run: lists damaged rows
 *   pnpm exec tsx scripts/repair-placeholders.ts --apply    # re-archives them + both webp siblings
 * Prints the URLs to purge at the edge (immutable 1y cache-control) at the end.
 */
import { fetchLargestStill, fetchStillBytes, putThumbSiblings, smallThumbUrl, heroSiblingUrl } from "../lib/thumb-blob";
import { putObject } from "../lib/r2";
import { d1, lit } from "./_d1";
import { loadEnvLocal } from "./_env";

loadEnvLocal();
const apply = process.argv.includes("--apply");

async function main() {
  const rows = d1<{ id: string; slug: string; thumbnail_url: string }>(
    "select id, slug, thumbnail_url from clips where published_at >= '2026-09-16T09:00' order by published_at desc",
  );
  const purge: string[] = [];
  let fixed = 0;
  let skipped = 0;
  for (const r of rows) {
    const head = await fetch(`${r.thumbnail_url}?x=${Math.random()}`, { method: "HEAD" });
    if (!(head.headers.get("content-type") ?? "").startsWith("image/gif")) continue;
    if (!apply) {
      console.log(`damaged ${r.id} ${r.slug}`);
      fixed++;
      continue;
    }
    const still = await fetchLargestStill(r.id);
    const got = still && (await fetchStillBytes(still));
    if (!still || !got) {
      console.warn(`still placeholder on fbcdn: ${r.id} ${r.slug}`);
      skipped++;
      continue;
    }
    const url = await putObject(`thumbs/${r.id}.jpg`, got.bytes, got.contentType);
    await putThumbSiblings(r.id, got.bytes);
    d1(
      `update clips set thumbnail_width=${lit(still.width)}, thumbnail_height=${lit(still.height)} where id=${lit(r.id)}`,
    );
    purge.push(url, smallThumbUrl(url), heroSiblingUrl(url));
    console.log(`fixed ${r.id} ${got.bytes.byteLength}B ${still.width}x${still.height}`);
    fixed++;
  }
  console.log(`${apply ? "fixed" : "damaged"} ${fixed}, skipped ${skipped}, scanned ${rows.length}`);
  if (purge.length) console.log(`\npurge at the edge:\n${purge.join("\n")}`);
}

main();
