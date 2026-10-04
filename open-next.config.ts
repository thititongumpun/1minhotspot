import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

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
// `set` writes R2 AND the local cache, `delete` clears both; other colos learn
// of an on-demand revalidation through the tag cache check on their next hit.
//
// Cache purge is deliberately NOT wired up: the adapter's purgeCache override
// invalidates by cache tag, and both tag purge and the Cache-Tag header are
// Cloudflare Enterprise features. This zone is on the Free plan.
export default defineCloudflareConfig({
	incrementalCache: withRegionalCache(r2IncrementalCache, {
		mode: "long-lived",
		// Off: the default re-read R2 and re-wrote the colo cache in waitUntil on
		// every hit, which the D1 tag cache below makes redundant (on-demand
		// revalidations are caught by the tag check; time-based staleness by the
		// entry's own lastModified). Saves one R2 GET plus a Cache API write per hit.
		shouldLazilyUpdateOnCacheHit: false,
	}),
	// Time-based ISR (revalidate = N) is inert on Workers without a queue; the
	// Durable Object queue dedupes revalidation and needs NEXT_CACHE_DO_QUEUE.
	queue: doQueue,
	// On-demand revalidation (revalidatePath in /api/ingest, revalidateClipLists)
	// was a no-op until this: the default tag cache is a dummy. The D1 "next
	// mode" tag cache stores tag timestamps in the `revalidations` table of the
	// NEXT_TAG_CACHE_D1 binding; populateCache creates the table on deploy and
	// preview. Cost: with the regional cache above, every page hit also runs one
	// D1 read to check whether its tags were revalidated since it was cached.
	tagCache: d1NextTagCache,
});
