/**
 * Dump Neon `clips` + `clip_scripts` as SQLite `insert or replace` statements
 * for `wrangler d1 execute 1minhotspot --remote --file <out>`.
 *   pnpm exec tsx scripts/neon-export.ts                       # full dump
 *   pnpm exec tsx scripts/neon-export.ts --since 2026-09-13T00:00:00Z   # rows with updated_at >= that (cutover delta)
 *
 * Writes db/export/<YYYYMMDD-HHMMSS>.sql, one statement per line. Values are
 * converted to the D1 schema (db/migrations/0001_init.sql): Date -> ISO 8601
 * UTC text, text[] -> JSON text, null -> NULL, integers unquoted.
 */
import { neon } from "@neondatabase/serverless";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const sinceIdx = process.argv.indexOf("--since");
const since = sinceIdx === -1 ? null : process.argv[sinceIdx + 1];
if (sinceIdx !== -1 && !since) {
  console.error("--since needs an ISO timestamp");
  process.exit(1);
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) v = v.toISOString();
  else if (Array.isArray(v)) v = JSON.stringify(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Explicit lists matching db/migrations/0001_init.sql: Neon's `clips` still has
// dead script_th/rewritten_title/source_url/source_publisher columns that D1
// does not, so `select *` would produce inserts D1 rejects.
const COLS = {
  clips:
    "slug, id, source, title, summary, body, category, published_at, updated_at, duration_sec, thumbnail_url, thumbnail_width, thumbnail_height, embed_url, permalink, tags, views, likes, comments",
  clip_scripts: "video_id, script_th, rewritten_title, source_url, source_publisher, updated_at, article_th",
};

function statement(table: keyof typeof COLS, r: Record<string, unknown>): string {
  const cols = COLS[table].split(", ");
  return `insert or replace into ${table} (${COLS[table]}) values (${cols.map((c) => lit(r[c])).join(", ")});`;
}

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error("Need DATABASE_URL in .env.local.");
    process.exit(1);
  }
  const sql = neon(DATABASE_URL);
  const where = since ? "where updated_at >= $1" : "";
  const params = since ? [since] : [];
  const fetchRows = (table: keyof typeof COLS, order: string) =>
    sql.query(`select ${COLS[table]} from ${table} ${where} order by ${order}`, params) as Promise<
      Record<string, unknown>[]
    >;

  const clips = await fetchRows("clips", "published_at");
  const scripts = await fetchRows("clip_scripts", "updated_at");

  const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const out = `db/export/${ts}.sql`;
  mkdirSync("db/export", { recursive: true });
  const lines = [...clips.map((r) => statement("clips", r)), ...scripts.map((r) => statement("clip_scripts", r))];
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`clips=${clips.length} clip_scripts=${scripts.length} since=${since ?? "(all)"} -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
