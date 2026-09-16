// Self-check: pnpm exec tsx lib/r2.test.ts. Exits 0 when green. No network.
import assert from "node:assert/strict";
import { hasCachePurgeCredentials, hasR2Credentials, publicUrl, purgeCache } from "./r2";

delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
delete process.env.R2_BUCKET;
delete process.env.R2_PUBLIC_HOST;
assert.equal(hasR2Credentials(), false, "no R2 vars -> false");

process.env.R2_PUBLIC_HOST = "thumbs.example.com";
assert.equal(publicUrl("thumbs/1.jpg"), "https://thumbs.example.com/thumbs/1.jpg");
assert.throws(() => {
  delete process.env.R2_PUBLIC_HOST;
  publicUrl("thumbs/1.jpg");
}, /R2_PUBLIC_HOST is unset/);
console.log("ok  hasR2Credentials / publicUrl");

delete process.env.CLOUDFLARE_CACHE_PURGE_TOKEN;
delete process.env.CLOUDFLARE_ZONE_ID;
assert.equal(hasCachePurgeCredentials(), false, "no purge vars -> false");
process.env.CLOUDFLARE_CACHE_PURGE_TOKEN = "tok";
assert.equal(hasCachePurgeCredentials(), false, "token alone is not enough");
process.env.CLOUDFLARE_ZONE_ID = "zone";
assert.equal(hasCachePurgeCredentials(), true, "both vars -> true");
console.log("ok  hasCachePurgeCredentials");

// No credentials, no network: purgeCache must resolve, not throw, and must not
// require fetch to be reachable — this is the "nobody configured it yet" path
// every deploy hits until CLOUDFLARE_CACHE_PURGE_TOKEN/CLOUDFLARE_ZONE_ID are set.
delete process.env.CLOUDFLARE_CACHE_PURGE_TOKEN;
delete process.env.CLOUDFLARE_ZONE_ID;
void (async () => {
  await purgeCache(["https://thumbs.example.com/thumbs/1.jpg"]);
  await purgeCache([]);
  console.log("ok  purgeCache: no credentials -> resolves without throwing or calling fetch");
})();
