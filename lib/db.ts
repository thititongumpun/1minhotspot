import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;

/**
 * Cheap "is there a database at all?" check. Reads env every call on purpose —
 * `process.env` is populated per-invocation on Vercel and this must never be
 * frozen into a module-scope constant at build time.
 */
export const hasDb = (): boolean => Boolean(process.env.DATABASE_URL);

/**
 * Lazy Neon client, `null` when DATABASE_URL is unset.
 *
 * Next.js evaluates top-level module code during `next build`, so calling
 * `neon()` at module scope crashes the build on any machine without the env
 * var (CI, a fresh clone, this repo right now — the Neon integration is not
 * provisioned yet). Hence the plain module-level `let` + accessor.
 *
 * Deliberately NOT a Proxy: wrapping the query function in one breaks the
 * driver's own introspection (`sql.query`, `sql.transaction`, `sql.unsafe` are
 * properties on the returned function) and fails in ways that are very hard to
 * debug. A nullable accessor is boring and obvious.
 */
export function getDb(): Sql | null {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client = neon(url);
  return client;
}
