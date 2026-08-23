/**
 * Credential + feed smoke check.
 *   pnpm exec tsx scripts/check-feed.ts
 * Reads .env.local, reports which page the token resolves to, what it can see,
 * and whether the site would serve real clips or fall back to sample data.
 */
import { loadEnvLocal } from "./_env";

loadEnvLocal();

async function main() {
  const { FB_PAGE_ID, FB_ACCESS_TOKEN, FB_API_VERSION = "v26.0" } = process.env;
  const g = async (path: string, params = "") => {
    const url = `https://graph.facebook.com/${FB_API_VERSION}/${path}?access_token=${FB_ACCESS_TOKEN}${params}`;
    const r = await fetch(url);
    return { status: r.status, body: await r.json() };
  };

  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    console.log("✗ FB_PAGE_ID / FB_ACCESS_TOKEN not set in .env.local — site serves SAMPLE data.");
    process.exit(1);
  }

  const me = await g("me", "&fields=id,name");
  console.log(`token resolves to: ${me.body.name ?? "?"} (id ${me.body.id ?? "?"})`);
  if (me.body.id !== FB_PAGE_ID) {
    console.log(`⚠ token page id ${me.body.id} != FB_PAGE_ID ${FB_PAGE_ID}`);
  }

  for (const edge of ["videos", "video_reels"]) {
    const r = await g(`${FB_PAGE_ID}/${edge}`, "&fields=id,length&limit=50");
    const n = r.body?.data?.length ?? 0;
    const reels = (r.body?.data ?? []).filter((v: { length?: number }) => (v.length ?? 0) <= 90).length;
    console.log(
      r.body?.error
        ? `✗ /${edge}: ${r.body.error.message}`
        : `${n ? "✓" : "✗"} /${edge}: ${n} items, ${reels} reel-length (<=90s)`,
    );
  }

  const { getClips } = await import("../lib/clips");
  const clips = await getClips();
  const sources = [...new Set(clips.map((c) => c.source))];
  console.log(`\ngetClips() → ${clips.length} clips, source(s): ${sources.join(", ")}`);
  console.log(sources.includes("sample") ? "✗ SAMPLE DATA — feed is not live." : "✓ live feed.");

}
main();
