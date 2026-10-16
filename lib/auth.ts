import { timingSafeEqual } from "node:crypto";

export const SECRET_HEADER = "x-ingest-secret";

/**
 * Constant-time secret check. Fails closed: with INGEST_SECRET unset every
 * request is rejected — there is no default and no unauthenticated write path.
 * The length guard is required because timingSafeEqual throws on unequal
 * lengths; it leaks only the secret's length, which is not the secret.
 */
export function authorized(provided: string | null): boolean {
  const expected = process.env.INGEST_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
