/**
 * Re-point archived clips at Graph's smaller `format` still.
 *   pnpm exec tsx scripts/shrink-thumbs.ts           # dry run, prints the diff
 *   pnpm exec tsx scripts/shrink-thumbs.ts --apply   # writes
 *
 * Rows written before lib/providers/facebook.ts started reading `format` hold
 * the native 1080x1920 reel still (~160 KB) that the 16:9 slots crop away most
 * of. New ingests fix themselves; the ~185 already archived need this pass.
 *
 * Re-querying each video by id also mints a fresh fbcdn signature, so this
 * doubles as a stopgap for the `oe=` expiry noted below.
 */
import { neon } from "@neondatabase/serverless";
import { pickFormat } from "../lib/providers/facebook";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const apply = process.argv.includes("--apply");
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

async function bytes(url: string): Promise<number> {
  const res = await fetch(url, { method: "HEAD" });
  return Number(res.headers.get("content-length") ?? 0);
}

async function main() {
  const { DATABASE_URL, FB_ACCESS_TOKEN } = process.env;
  const version = process.env.FB_API_VERSION || "v26.0";
  if (!DATABASE_URL || !FB_ACCESS_TOKEN) {
    console.error("Need DATABASE_URL and FB_ACCESS_TOKEN in .env.local.");
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);
  const rows = (await sql`
    select id, slug, thumbnail_url, thumbnail_width from clips order by published_at desc
  `) as { id: string; slug: string; thumbnail_url: string; thumbnail_width: number }[];

  let updated = 0;
  let before = 0;
  let after = 0;

  for (const row of rows) {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(row.id)}` +
        `?fields=format&access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}`,
    );
    const json = (await res.json().catch(() => ({}))) as {
      format?: { filter?: string; picture?: string; width?: number; height?: number }[];
      error?: { message?: string };
    };
    // A clip Graph no longer serves keeps whatever it has — a stale still beats
    // a null one, and this script must never make a row worse.
    if (json.error || !json.format) {
      console.warn(`skip ${row.slug}: ${json.error?.message ?? "no format field"}`);
      continue;
    }

    const pick = pickFormat(json.format);
    if (!pick || pick.url === row.thumbnail_url) continue;

    before += await bytes(row.thumbnail_url);
    after += await bytes(pick.url);
    updated++;
    console.log(`${row.thumbnail_width} -> ${pick.width}  ${row.slug}`);

    if (apply) {
      await sql`
        update clips
           set thumbnail_url = ${pick.url},
               thumbnail_width = ${pick.width},
               thumbnail_height = ${pick.height}
         where id = ${row.id}
      `;
    }
  }

  console.log(
    `\n${apply ? "updated" : "would update"} ${updated}/${rows.length} rows: ` +
      `${kb(before)} -> ${kb(after)}${apply ? "" : "   (re-run with --apply)"}`,
  );
}

main();
