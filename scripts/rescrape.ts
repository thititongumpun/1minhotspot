/**
 * Ask Facebook to re-scrape the /v/<id> comment link for archived clips.
 *   pnpm exec tsx scripts/rescrape.ts            # newest 100
 *   pnpm exec tsx scripts/rescrape.ts --limit 500
 *   pnpm exec tsx scripts/rescrape.ts 1428749249181335 ...   # specific ids
 *
 * Facebook caches one link preview per URL for ~30 days. Every Reel commented
 * before robots.txt stopped disallowing /v/ carries a bare "1minhotspot.com"
 * card; new ingests re-scrape themselves (app/api/ingest/route.ts). This is
 * the one-off pass for the backlog. Sequential on purpose — Graph rate-limits
 * scrape calls, and each one makes Facebook fetch the article.
 */
import { rescrapeUrl } from "../lib/providers/facebook";
import { absoluteUrl } from "../lib/seo";
import { d1 } from "./_d1";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--limit");
  const limit = at >= 0 ? Number(args[at + 1]) : 100;
  const given = args.filter((a) => /^\d{5,}$/.test(a));

  const ids = given.length
    ? given
    : d1<{ id: string }>(`select id from clips order by published_at desc limit ${limit}`).map((r) => r.id);

  let ok = 0;
  for (const id of ids) {
    const done = await rescrapeUrl(absoluteUrl(`/v/${id}`));
    ok += done ? 1 : 0;
    console.log(`${done ? "✓" : "✗"} /v/${id}`);
  }
  console.log(`${ok}/${ids.length} re-scraped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
