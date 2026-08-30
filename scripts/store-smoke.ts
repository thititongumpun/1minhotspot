/**
 * Persistence layer smoke check.
 *   pnpm exec tsx scripts/store-smoke.ts
 *
 * Two halves:
 *  1. Always runs — with DATABASE_URL unset every store function must return
 *     empty/null/false instead of throwing.
 *  2. Runs only when DATABASE_URL is set — round-trips a clip and proves the
 *     upsert is idempotent (one row, published_at unchanged). Skips with a
 *     clear message otherwise, so this is safe to run on a laptop with no DB.
 *
 * Apply db/schema.sql first: psql "$DATABASE_URL" -f db/schema.sql
 */
import { strict as assert } from "node:assert";
import type { Clip } from "../lib/types";
import { loadEnvLocal } from "./_env";

loadEnvLocal();

const SLUG = "store-smoke-เทสต์-0000test";
const VIDEO_ID = "store-smoke-0000test";

const fixture = (title: string, updatedAt: string): Clip => ({
  id: "store-smoke-0000test",
  slug: SLUG,
  source: "sample",
  title,
  summary: "แถวนี้ถูกสร้างโดยสคริปต์ทดสอบ และจะถูกลบทิ้งเมื่อจบการทดสอบ",
  body: "",
  category: "viral",
  publishedAt: "2020-01-02T03:04:05.000Z",
  updatedAt,
  durationSec: 47,
  thumbnail: { url: "https://example.invalid/t.jpg", width: 1280, height: 720 },
  embedUrl: "https://example.invalid/embed",
  permalink: "https://example.invalid/permalink",
  tags: ["สโมค", "เทสต์"],
});

async function main() {
  const {
    upsertClip,
    upsertScript,
    getStoredClips,
    getStoredClipBySlug,
    getStoredSourceUrl,
  } = await import("../lib/store");
  const { getDb, hasDb } = await import("../lib/db");

  // ---- 1. no DATABASE_URL: never throw ------------------------------------
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  assert.equal(hasDb(), false, "hasDb() must be false with DATABASE_URL unset");
  assert.equal(getDb(), null, "getDb() must return null with DATABASE_URL unset");
  assert.deepEqual(await getStoredClips(), [], "getStoredClips() must return []");
  assert.equal(await getStoredClipBySlug(SLUG), null, "getStoredClipBySlug() must return null");
  assert.equal(await upsertClip(fixture("a", "2020-01-02T03:04:05.000Z")), false, "upsert -> false");
  assert.equal(await upsertScript({ videoId: VIDEO_ID, scriptTh: "x" }), false, "upsertScript -> false");
  assert.equal(await getStoredSourceUrl(VIDEO_ID), null, "getStoredSourceUrl() must return null");
  console.log("✓ no DATABASE_URL: all store functions returned empty without throwing.");

  if (saved) process.env.DATABASE_URL = saved;

  // ---- 2. round trip ------------------------------------------------------
  if (!saved) {
    console.log(
      "⏭ SKIPPED round-trip: DATABASE_URL is not set.\n" +
        "  Provision Neon (vercel integration add neon), apply db/schema.sql, then\n" +
        "  re-run:  DATABASE_URL='postgres://...' pnpm exec tsx scripts/store-smoke.ts",
    );
    return;
  }

  const sql = getDb();
  assert.ok(sql, "getDb() must return a client when DATABASE_URL is set");

  try {
    assert.equal(await upsertClip(fixture("หัวข้อแรก", "2020-01-02T03:04:05.000Z")), true);

    const first = await getStoredClipBySlug(SLUG);
    assert.ok(first, "clip must round-trip back out of the store");
    assert.equal(first.slug, SLUG);
    assert.equal(first.title, "หัวข้อแรก");
    assert.equal(first.publishedAt, "2020-01-02T03:04:05.000Z");
    assert.deepEqual(first.tags, ["สโมค", "เทสต์"]);
    assert.equal(first.durationSec, 47);
    assert.deepEqual(first.thumbnail, { url: "https://example.invalid/t.jpg", width: 1280, height: 720 });
    console.log("✓ round trip: upsertClip -> getStoredClipBySlug returned an identical Clip.");

    // Retry with a different published_at and title: must update the title,
    // must NOT move published_at, must NOT create a second row.
    const retry = { ...fixture("หัวข้อที่แก้แล้ว", "2021-06-07T08:09:10.000Z"), publishedAt: "2021-06-07T08:09:10.000Z" };
    assert.equal(await upsertClip(retry), true);

    const rows = await sql`select count(*)::int as n from clips where slug = ${SLUG}`;
    assert.equal(rows[0].n, 1, "a retry must not duplicate the row");

    const second = await getStoredClipBySlug(SLUG);
    assert.ok(second);
    assert.equal(second.publishedAt, "2020-01-02T03:04:05.000Z", "published_at must be preserved");
    assert.equal(second.title, "หัวข้อที่แก้แล้ว", "mutable fields must update");
    console.log("✓ idempotent: second upsert kept one row and the original published_at.");

    // The n8n rewrite lives in its own table, joined on video_id by clips_full.
    assert.equal(
      await upsertScript({
        videoId: VIDEO_ID,
        scriptTh: "บทบรรยายที่เขียนใหม่",
        rewrittenTitle: "พาดหัวที่เขียนใหม่",
        sourceUrl: "https://example.invalid/source",
        sourcePublisher: "example",
      }),
      true,
    );
    const withScript = await getStoredClipBySlug(SLUG);
    assert.equal(withScript?.body, "บทบรรยายที่เขียนใหม่", "script_th must become the body");
    assert.equal(withScript?.title, "พาดหัวที่เขียนใหม่", "rewritten_title must win for display");
    assert.equal(withScript?.slug, SLUG, "a rewritten title must NOT move the url");
    console.log("✓ join: clips_full folded the rewrite into body/title, slug unchanged.");

    // source-article.ts falls back to this when the Page's own "อ่านเพิ่มเติม"
    // comment is missing, edited, or off the end of the comments edge.
    assert.equal(
      await getStoredSourceUrl(VIDEO_ID),
      "https://example.invalid/source",
      "getStoredSourceUrl must return the URL n8n sent",
    );
    assert.equal(
      await getStoredSourceUrl("store-smoke-no-such-video"),
      null,
      "an unknown video id must yield null, not throw",
    );
    console.log("✓ source url: stored URL readable by video id, unknown id -> null.");

    // A partial retry must not erase what is already stored.
    assert.equal(await upsertScript({ videoId: VIDEO_ID, sourcePublisher: "example" }), true);
    const kept = await getStoredClipBySlug(SLUG);
    assert.equal(kept?.body, "บทบรรยายที่เขียนใหม่", "a retry without scriptTh must not wipe it");
    console.log("✓ coalesce: a partial retry did not lose the stored rewrite.");

    // A script that arrives before its clip must not fail or invent a clip.
    assert.equal(await upsertScript({ videoId: "store-smoke-orphan", scriptTh: "ก" }), true);
    const orphan = await sql`select count(*)::int as n from clips where id = 'store-smoke-orphan'`;
    assert.equal(orphan[0].n, 0, "an early script must not create a clip row");
    console.log("✓ early script: stored with no clip present, no phantom clip created.");

    // Listing path sees the row. The fixture is dated 2020 on purpose so it can
    // never surface on the live site mid-run — which also means it sorts below
    // the newest DEFAULT_LIMIT rows as soon as `clips` holds more than that
    // (it passed 500 in Aug 2026). Ask for the whole table: this is a manual
    // smoke run, its egress does not matter, and a limit tied to the table's
    // size is the only one that stays true.
    const listed = (await getStoredClips(Number.MAX_SAFE_INTEGER)).find((c) => c.slug === SLUG);
    assert.ok(listed, "listing must include the clip");
    console.log("✓ listing: newest-first listing returned the clip.");

    // getStoredClips/getMostViewed select an explicit column list (not
    // select *) to cut Neon egress — body/script_th are deliberately absent.
    // Prove the trim happened AND that rewritten_title (the join, the
    // headline actually shown) survived it, and that the by-slug row -
    // which getClip() uses for the article body - is still full.
    assert.equal(listed.body, "", "list rows must not carry a body");
    assert.equal(listed.hasScript, false, "list rows must not carry script_th");
    assert.equal(listed.title, "พาดหัวที่เขียนใหม่", "list rows MUST keep rewritten_title");
    assert.equal(
      (await getStoredClipBySlug(SLUG))?.body,
      "บทบรรยายที่เขียนใหม่",
      "by-slug row must still carry the full script body",
    );
    console.log("✓ list projection: no body/script_th, rewritten_title kept, by-slug row still full.");
  } finally {
    await sql`delete from clips where slug = ${SLUG}`;
    await sql`delete from clip_scripts where video_id in (${VIDEO_ID}, 'store-smoke-orphan')`;
    console.log("✓ cleaned up the test row.");
  }

  console.log("\nAll store checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
