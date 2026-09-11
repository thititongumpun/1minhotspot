import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// ISR page cache backed by R2, via the "NEXT_INC_CACHE_R2_BUCKET" binding in
// wrangler.jsonc. Separate from lib/r2.ts (thumbnail storage over the R2 S3
// API): this is the adapter's own binding-based store for revalidated pages.
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
});
