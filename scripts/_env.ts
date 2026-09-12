import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

/**
 * Minimal .env.local loader for the tsx scripts. Next loads .env.local itself;
 * plain node/tsx does not, and dotenv is not a dependency here.
 *
 * `vercel env pull` wrote every value double-quoted (FB_ACCESS_TOKEN="EAA…").
 * Those quotes are file syntax, not part of the value — keeping them sends a
 * token with a leading `"` to Graph. Strip a matching pair, never a lone quote.
 *
 * Existing process env always wins, so `FB_ACCESS_TOKEN=… pnpm exec tsx …` still
 * overrides the file.
 */
export function loadEnvLocal(path = ".env.local"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = unquote(m[2]);
  }
}

/** Strips one matching pair of surrounding quotes. Exported for the self-check. */
export function unquote(v: string): string {
  const q = v[0];
  return (q === '"' || q === "'") && v.length >= 2 && v.at(-1) === q ? v.slice(1, -1) : v;
}

// Self-check: pnpm exec tsx scripts/_env.ts
if (process.argv[1]?.endsWith("_env.ts")) {
  assert.equal(unquote('"https://a:b@h/db?x=1"'), "https://a:b@h/db?x=1");
  assert.equal(unquote("'tok'"), "tok");
  assert.equal(unquote("plain"), "plain");
  assert.equal(unquote('"unbalanced'), '"unbalanced', "a lone quote is part of the value");
  assert.equal(unquote('say "hi"'), 'say "hi"', "inner quotes must survive");
  assert.equal(unquote('"'), '"', "a single quote char is not a pair");
  assert.equal(unquote(""), "");
  console.log("ok scripts/_env.ts");
}
