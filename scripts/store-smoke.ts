/**
 * Persistence layer smoke check.
 *   pnpm exec tsx scripts/store-smoke.ts
 *
 * Two halves:
 *  1. Always runs — outside the Worker there is no D1 binding, so every store
 *     function must return empty/null/false instead of throwing.
 *  2. Runs only when remote D1 answers — round-trips a clip through the same
 *     upsert SQL lib/store.ts uses and proves it is idempotent under SQLite
 *     (one row, published_at unchanged, title updated). Skips with a clear
 *     message otherwise, so this is safe to run on a laptop with no wrangler login.
 *
 * Apply the schema first: pnpm exec wrangler d1 migrations apply 1minhotspot --remote
 */
import { strict as assert } from "node:assert";
import { d1, lit } from "./_d1";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const SLUG = "store-smoke-เทสต์-0000test";
const VIDEO_ID = "store-smoke-0000test";
const PUBLISHED = "2020-01-02T03:04:05.000Z";

/** Same shape as upsertClip in lib/store.ts (plan §2.2): SQLite `is not`, scalar max(), JSON tags. */
const upsertSql = (title: string, publishedAt: string, updatedAt: string) => `
  insert into clips (
    slug, id, source, title, summary, body, category,
    published_at, updated_at, duration_sec,
    thumbnail_url, thumbnail_width, thumbnail_height,
    embed_url, permalink, tags, views, likes, comments
  ) values (
    ${lit(SLUG)}, ${lit(VIDEO_ID)}, 'sample', ${lit(title)},
    'แถวนี้ถูกสร้างโดยสคริปต์ทดสอบ และจะถูกลบทิ้งเมื่อจบการทดสอบ', '', 'viral',
    ${lit(publishedAt)}, ${lit(updatedAt)}, 47,
    'https://example.invalid/t.jpg', 1280, 720,
    'https://example.invalid/embed', 'https://example.invalid/permalink',
    ${lit(JSON.stringify(["สโมค", "เทสต์"]))}, 0, 0, 0
  )
  on conflict (slug) do update set
    id = excluded.id, source = excluded.source, title = excluded.title,
    summary = excluded.summary, body = excluded.body, category = excluded.category,
    updated_at = case
                   when clips.title is not excluded.title
                     or clips.body is not excluded.body
                     or clips.summary is not excluded.summary
                   then excluded.updated_at else clips.updated_at
                 end,
    duration_sec = excluded.duration_sec,
    thumbnail_url = excluded.thumbnail_url, thumbnail_width = excluded.thumbnail_width,
    thumbnail_height = excluded.thumbnail_height,
    embed_url = excluded.embed_url, permalink = excluded.permalink, tags = excluded.tags,
    views = max(clips.views, excluded.views), likes = max(clips.likes, excluded.likes),
    comments = max(clips.comments, excluded.comments)
`;

type Row = { n: number; title: string; published_at: string; updated_at: string; tags: string };

async function main() {
  const { upsertClip, upsertScript, getStoredClips, getStoredClipBySlug, getStoredSourceUrl } =
    await import("../lib/store");
  const { getDb } = await import("../lib/db");

  // ---- 1. no binding: never throw --------------------------------------------
  assert.equal(await getDb(), null, "getDb() must return null outside the Worker");
  assert.deepEqual(await getStoredClips(), [], "getStoredClips() must return []");
  assert.equal(await getStoredClipBySlug(SLUG), null, "getStoredClipBySlug() must return null");
  assert.equal(
    await upsertClip({
      id: VIDEO_ID, slug: SLUG, source: "sample", title: "a", summary: "", body: "", category: "viral",
      publishedAt: PUBLISHED, updatedAt: PUBLISHED, durationSec: 47,
      thumbnail: { url: "https://example.invalid/t.jpg", width: 1280, height: 720 },
      embedUrl: "https://example.invalid/embed", permalink: "https://example.invalid/permalink", tags: [],
    }),
    false,
    "upsert -> false",
  );
  assert.equal(await upsertScript({ videoId: VIDEO_ID, scriptTh: "x" }), false, "upsertScript -> false");
  assert.equal(await getStoredSourceUrl(VIDEO_ID), null, "getStoredSourceUrl() must return null");
  console.log("✓ no D1 binding: all store functions returned empty without throwing.");

  // ---- 2. round trip on remote D1 -------------------------------------------
  try {
    d1("select 1 from clips limit 0");
  } catch (err) {
    console.log(
      `⏭ SKIPPED round-trip: remote D1 not reachable (${(err as Error).message.split("\n")[0]}).\n` +
        "  Log in (pnpm exec wrangler login), apply the schema (see header), then re-run.",
    );
    return;
  }

  const read = () =>
    d1<Row>(`select count(*) as n, title, published_at, updated_at, tags from clips where slug = ${lit(SLUG)}`)[0];

  try {
    d1(upsertSql("หัวข้อแรก", PUBLISHED, PUBLISHED));
    const first = read();
    assert.equal(first.n, 1, "clip must round-trip into clips");
    assert.equal(first.title, "หัวข้อแรก");
    assert.equal(first.published_at, PUBLISHED);
    assert.deepEqual(JSON.parse(first.tags), ["สโมค", "เทสต์"], "tags must round-trip as JSON");
    console.log("✓ round trip: upsert wrote the row, tags survived as JSON.");

    // Retry with a different published_at and title: must update the title and
    // updated_at, must NOT move published_at, must NOT create a second row.
    // SQLite reads `clips.*` in the SET against the pre-update row, so the
    // `is not` guard must still fire even though title is assigned above it.
    d1(upsertSql("หัวข้อที่แก้แล้ว", "2021-06-07T08:09:10.000Z", "2021-06-07T08:09:10.000Z"));
    const second = read();
    assert.equal(second.n, 1, "a retry must not duplicate the row");
    assert.equal(second.published_at, PUBLISHED, "published_at must be preserved");
    assert.equal(second.title, "หัวข้อที่แก้แล้ว", "mutable fields must update");
    assert.equal(second.updated_at, "2021-06-07T08:09:10.000Z", "updated_at must move when the title changed");

    // Same payload again: nothing changed, so updated_at must hold.
    d1(upsertSql("หัวข้อที่แก้แล้ว", PUBLISHED, "2022-01-01T00:00:00.000Z"));
    assert.equal(read().updated_at, "2021-06-07T08:09:10.000Z", "an unchanged retry must not bump updated_at");
    console.log("✓ idempotent: one row, original published_at kept, updated_at only moves on a real edit.");
  } finally {
    d1(`delete from clips where slug = ${lit(SLUG)}`);
    console.log("✓ cleaned up the test row.");
  }

  console.log("\nAll store checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
