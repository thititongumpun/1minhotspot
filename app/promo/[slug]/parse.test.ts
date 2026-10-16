// Run: pnpm exec tsx "app/promo/[slug]/parse.test.ts"
import assert from "node:assert/strict";
import { blocks, splitTitle } from "./parse";

assert.deepEqual(splitTitle("MEYER Hello Kitty — เครื่องครัว — ลาย"), ["MEYER Hello Kitty", "เครื่องครัว — ลาย"]);
assert.deepEqual(splitTitle("No dash-here"), ["No dash-here", undefined]);

assert.deepEqual(blocks("Lead para\n\nIn the set\n- a\n- b \n\n- c\n\n\nTail para"), [
  { kind: "p", text: "Lead para" },
  { kind: "list", heading: "In the set", items: ["a", "b"] },
  { kind: "list", heading: undefined, items: ["c"] },
  { kind: "p", text: "Tail para" },
]);

console.log("parse.test OK");
