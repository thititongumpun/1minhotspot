// Self-check, no framework: `pnpm exec tsx lib/providers/facebook.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";
import { FIELDS_WITHOUT_VIEWS, pickFormat, toClip, type GraphVideo } from "./facebook";

// The four sizes Graph actually returns for a reel, smallest first.
const GRAPH = [
  { filter: "130x130", picture: "https://cdn/130.jpg", width: 130, height: 231 },
  { filter: "480x480", picture: "https://cdn/480.jpg", width: 480, height: 853 },
  { filter: "720x720", picture: "https://cdn/720.jpg", width: 720, height: 1280 },
  { filter: "native", picture: "https://cdn/1080.jpg", width: 1080, height: 1920 },
];

function main() {
  assert.deepEqual(
    pickFormat(GRAPH),
    { url: "https://cdn/720.jpg", width: 720, height: 1280 },
    "picks the smallest variant at or above the 720 target, not the native still",
  );

  // Graph is not required to return them in order.
  assert.equal(pickFormat([...GRAPH].reverse())?.width, 720, "order-independent");

  // Nothing wide enough: take the widest on offer rather than dropping the clip.
  assert.equal(pickFormat(GRAPH.slice(0, 2))?.width, 480, "falls back to the widest available");

  // Partial entries are unusable — a url with no dimensions breaks <Image>.
  assert.equal(pickFormat([{ filter: "native", width: 1080 }]), null, "drops dimensionless entries");
  assert.equal(pickFormat([]), null, "empty");
  assert.equal(pickFormat(undefined), null, "absent field falls through to thumbnails");

  // The degraded field list is what stands between a Graph rejection of
  // `views` and the whole site dropping to fabricated sample data. It must
  // lose exactly one field and stay a valid comma list — no empty entry from
  // a stray comma, whatever position `views` was in.
  const fields = FIELDS_WITHOUT_VIEWS.split(",");
  assert.ok(!fields.includes("views"), "views is gone");
  assert.ok(fields.includes("id") && fields.includes("length"), "everything else survives");
  assert.ok(
    fields.every((f) => f.length > 0),
    "no empty field left behind by the removal",
  );

  // toClip is the one mapper behind both the feed and the by-id fetch that
  // /v/<id> uses for a reel the hourly feed has not seen. The slug it yields
  // is the row key, so the two paths must agree or the store gets two rows.
  const video: GraphVideo = {
    id: "123456789",
    title: "ข่าวด่วน ทดสอบ",
    description: "รายละเอียด #ข่าว",
    permalink_url: "/reel/123456789",
    created_time: "2026-09-08T01:00:00+0000",
    length: 45,
    format: GRAPH,
    views: 7,
  };
  const clip = toClip(video, "page");
  assert.ok(clip, "reel-length video with a still maps to a clip");
  assert.equal(clip.id, "123456789");
  assert.equal(clip.slug, toClip({ ...video }, "page")?.slug, "deterministic slug");
  assert.equal(clip.thumbnail.width, 720, "uses pickFormat");
  assert.equal(clip.permalink, "https://www.facebook.com/reel/123456789");
  assert.equal(clip.publishedAt, "2026-09-08T01:00:00.000Z");
  assert.equal(clip.views, 7);
  assert.equal(toClip({ ...video, length: 120 }, "page"), null, "over MAX_DURATION_SEC is dropped");
  assert.equal(toClip({ ...video, format: undefined }, "page"), null, "no still is dropped");

  console.log("facebook.test.ts OK");
}

main();
