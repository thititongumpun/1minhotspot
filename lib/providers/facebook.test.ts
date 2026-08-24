// Self-check, no framework: `pnpm exec tsx lib/providers/facebook.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";
import { pickFormat } from "./facebook";

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

  console.log("facebook.test.ts OK");
}

main();
