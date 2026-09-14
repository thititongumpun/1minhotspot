import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";

/**
 * Remote D1 for the local tsx scripts. There is no D1 client for plain Node
 * outside the Worker, so shell out to wrangler and read its --json output
 * (an array of `{ results, success, meta }`, one per statement).
 *
 * `--command` has no bind params: embed values with lit(). ~1s per call.
 */
export function d1<T = Record<string, unknown>>(sql: string): T[] {
  const args = ["exec", "wrangler", "d1", "execute", "1minhotspot", "--remote", "--json", "--command", sql];
  try {
    // maxBuffer: execFileSync defaults to 1MB and throws ENOBUFS past it —
    // surfacing here as a bogus "wrangler d1 failed" with the real rows in the
    // error's stdout. An uncapped select over the whole clips table is ~2MB
    // today and grows, so the default is a time bomb on every read path.
    const opts = { encoding: "utf8" as const, stdio: "pipe" as const, maxBuffer: 256 * 1024 * 1024 };
    return (JSON.parse(execFileSync("pnpm", args, opts)) as { results: T[] }[])[0].results;
  } catch (err) {
    // wrangler prints its error JSON on stdout (stderr is usually empty).
    const e = err as { stderr?: string; stdout?: string; message: string };
    throw new Error(`wrangler d1 failed: ${e.stderr?.trim() || e.stdout?.trim() || e.message}`);
  }
}

/** SQL literal: quotes strings (doubling embedded quotes), passes numbers and null through. */
export function lit(v: string | number | null): string {
  return v === null ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;
}

// Self-check: pnpm exec tsx scripts/_d1.ts
if (process.argv[1]?.endsWith("_d1.ts")) {
  assert.equal(lit("it's"), "'it''s'");
  assert.equal(lit("ไทย"), "'ไทย'");
  assert.equal(lit(""), "''");
  assert.equal(lit(47), "47");
  assert.equal(lit(null), "null");
  console.log("ok scripts/_d1.ts");
}
