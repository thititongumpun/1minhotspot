import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// ISR page cache backed by R2, via the "NEXT_INC_CACHE_R2_BUCKET" binding in
// wrangler.jsonc. Separate from lib/r2.ts (thumbnail storage over the R2 S3
// API): this is the adapter's own binding-based store for revalidated pages.
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
	// Time-based ISR (revalidate = N) is inert on Workers without a queue; the
	// Durable Object queue dedupes revalidation and needs NEXT_CACHE_DO_QUEUE.
	queue: doQueue,
});
