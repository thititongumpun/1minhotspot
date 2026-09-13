import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// ISR page cache backed by R2, via the "NEXT_INC_CACHE_R2_BUCKET" binding in
// wrangler.jsonc. Separate from lib/r2.ts (thumbnail storage over the R2 S3
// API): this is the adapter's own binding-based store for revalidated pages.
//
// withRegionalCache puts the per-colo Cache API in front of R2. Cloudflare does
// NOT cache HTML on the Free plan (documents come back with no cf-cache-status
// at all), so every hit ran the Worker and paid a cross-network R2 GET even on
// an ISR HIT: ~200 ms over a CDN hit at the median, spiking past 1.1 s on a cold
// read. The Cache API read is colo-local, so that round trip disappears.
//
// Staleness is bounded to one request per colo and self-heals: `set` writes R2
// AND the local cache, `delete` clears both, and `shouldLazilyUpdateOnCacheHit`
// (the Next 16 default here, since bypassTagCacheOnCacheHit stays false)
// re-reads R2 in waitUntil on every hit. So a colo holding a pre-publish entry
// serves it once, then refreshes — revalidateClipLists() still surfaces a new
// story in seconds, which a CDN cache rule with s-maxage would have delayed by
// up to the full ~54 minute TTL.
//
// Cache purge is deliberately NOT wired up: the adapter's purgeCache override
// invalidates by cache tag, and both tag purge and the Cache-Tag header are
// Cloudflare Enterprise features. This zone is on the Free plan.
export default defineCloudflareConfig({
	incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
	// Time-based ISR (revalidate = N) is inert on Workers without a queue; the
	// Durable Object queue dedupes revalidation and needs NEXT_CACHE_DO_QUEUE.
	queue: doQueue,
});
