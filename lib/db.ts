// Just the slice of Cloudflare's D1Database used by lib/store.ts. `wrangler types` would
// generate the real one, but its global Workers runtime types collide with @types/node
// across the repo (same call as ImagesBinding in lib/thumb-blob.ts).
export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type D1 = {
  prepare(sql: string): D1PreparedStatement;
};

/**
 * The `DB` D1 binding when running inside the Worker, else `null`.
 *
 * Async mode on purpose: `next build` prerenders the static routes outside a
 * request, where the sync accessor throws. `{ async: true }` makes OpenNext
 * hand back wrangler's platform proxy instead. The binding is `remote: true`
 * in wrangler.jsonc, so that proxy reaches the real D1 and the prerendered
 * article pages are built from the archive, not blanked.
 *
 * Never throws. Under plain `tsx` (scripts, lib/*.test.ts) the dynamic import
 * or the context lookup fails and that is the "no database" case — lib/store.ts
 * `run()` already turns `null` into its per-query fallback, so the site keeps
 * building and serving from the live Facebook feed with no database at all.
 */
export async function getDb(): Promise<D1 | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return ((await getCloudflareContext({ async: true })).env as { DB?: D1 }).DB ?? null;
  } catch {
    return null; // not on Workers (tsx script, plain next build)
  }
}
