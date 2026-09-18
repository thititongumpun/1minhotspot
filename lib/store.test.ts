// Self-check, no framework, no DB: `pnpm exec tsx lib/store.test.ts`. Exits 0 when green.
// Do NOT import lib/clips.ts here — it pulls next/cache and fails under tsx
// (see lib/clips.test.ts history).
import assert from "node:assert/strict";
import { bangkokMonthStartIso, engagementBinds } from "./store";

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
  console.log("ok  engagementBinds: drops countless rows, zero-fills for max()");

  // bangkokMonthStartIso is already exercised by clips.test.ts through
  // pickMostViewedThisMonth; a direct sanity check here keeps this file
  // self-contained without importing lib/clips.ts.
  assert.equal(bangkokMonthStartIso(new Date("2026-09-18T10:00:00Z")), "2026-08-31T17:00:00.000Z");

  console.log("store.test.ts OK");
}

main();
