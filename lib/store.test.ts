// Self-check, no framework, no DB: `pnpm exec tsx lib/store.test.ts`. Exits 0 when green.
// Do NOT import lib/clips.ts here — it pulls next/cache and fails under tsx
// (see lib/clips.test.ts history).
import assert from "node:assert/strict";
import { bangkokMonthStartIso, engagementBinds, toPromotion } from "./store";

function main() {
  assert.deepEqual(
    engagementBinds([{ id: "a", views: 3 }, { id: "b" }, { id: "c", likes: 1, comments: undefined }]),
    [
      [3, 0, 0, "a"],
      [0, 1, 0, "c"],
    ],
    "drops the countless row, zero-fills the rest for max()",
  );
  assert.deepEqual(engagementBinds([]), []);
  assert.deepEqual(
    engagementBinds([{ id: "d", views: 3, likes: Number.NaN }]),
    [[3, 0, 0, "d"]],
    "a NaN sibling field doesn't ride through on `?? 0` once one field is finite",
  );
  console.log("ok  engagementBinds: drops countless rows, zero-fills for max()");

  // bangkokMonthStartIso is already exercised by clips.test.ts through
  // pickMostViewedThisMonth; a direct sanity check here keeps this file
  // self-contained without importing lib/clips.ts.
  assert.equal(bangkokMonthStartIso(new Date("2026-09-18T10:00:00Z")), "2026-08-31T17:00:00.000Z");

  assert.deepEqual(
    toPromotion({
      slug: "meyer-hello-kitty",
      brand: "MEYER",
      title: "t",
      summary: "s",
      body: "p1\n\np2",
      images: '[{"url":"/promo-dev/01-1280.webp","w":1280,"h":960,"alt":"a"}]',
      links: "not json",
      starts_at: "2026-10-16T00:00:00Z",
      ends_at: "2026-11-06T16:59:59Z",
      created_at: "2026-10-16T00:00:00.000Z",
    }),
    {
      slug: "meyer-hello-kitty",
      brand: "MEYER",
      title: "t",
      summary: "s",
      body: "p1\n\np2",
      images: [{ url: "/promo-dev/01-1280.webp", w: 1280, h: 960, alt: "a" }],
      links: [],
      startsAt: "2026-10-16T00:00:00.000Z",
      endsAt: "2026-11-06T16:59:59.000Z",
    },
    "parses JSON columns, falls back to [] on bad JSON, normalises timestamps",
  );
  console.log("ok  toPromotion: JSON columns parsed, bad JSON → [], timestamps via iso()");

  console.log("store.test.ts OK");
}

main();
