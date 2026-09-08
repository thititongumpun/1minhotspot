// Self-check: pnpm exec tsx lib/thumb-blob.test.ts. Exits 0 when green. No network.
import assert from "node:assert/strict";
import { isArchivedUrl, isVercelBlobUrl, largestFormat } from "./thumb-blob";
import { pickFormat } from "./providers/facebook";

// Shape Graph returns for `fields=format`: one preferred frame at several sizes.
const formats = [
  { filter: "130x130", picture: "https://scontent-bkk1-1.xx.fbcdn.net/130.jpg", width: 130, height: 130 },
  { filter: "600x600", picture: "https://scontent-bkk1-1.xx.fbcdn.net/720.jpg", width: 720, height: 1280 },
  { filter: "native", picture: "https://scontent-bkk1-1.xx.fbcdn.net/1080.jpg", width: 1080, height: 1920 },
  { filter: "broken", width: 4000 }, // no picture — must be ignored, not crash
];

const largest = largestFormat(formats);
assert.ok(largest, "a usable format must be picked");
assert.equal(largest.width, 1080, "largestFormat must take the widest usable entry");
assert.equal(largest.height, 1920);
assert.equal(largest.url, "https://scontent-bkk1-1.xx.fbcdn.net/1080.jpg");

// Deliberately the opposite of the render path: pickFormat optimises bytes on
// the wire (smallest still wide enough), this optimises Discover's minimum.
const small = pickFormat(formats);
assert.ok(small && small.width < largest.width, "pickFormat must pick a smaller still on the same input");
console.log(`ok  largestFormat: ${largest.width}px vs pickFormat's ${small.width}px on the same input`);

assert.equal(largestFormat([]), null, "no formats -> null");
assert.equal(largestFormat(undefined), null, "missing format field -> null");
assert.equal(largestFormat([{ filter: "x", width: 100 }]), null, "no picture -> null");
console.log("ok  largestFormat: empty / undefined / picture-less input yields null");

process.env.R2_PUBLIC_HOST = "thumbs.example.com";
assert.equal(isArchivedUrl("https://thumbs.example.com/thumbs/1.jpg"), true, "R2 host is archived");
assert.equal(isArchivedUrl("https://abc.public.blob.vercel-storage.com/thumbs/1.jpg"), true, "retired Blob host still archived");
assert.equal(isArchivedUrl("https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0"), false);
assert.equal(isArchivedUrl("not a url"), false, "a malformed URL must not throw");
assert.equal(isVercelBlobUrl("https://abc.public.blob.vercel-storage.com/thumbs/1.jpg"), true);
assert.equal(isVercelBlobUrl("https://thumbs.example.com/thumbs/1.jpg"), false, "R2 rows are not --force targets");
delete process.env.R2_PUBLIC_HOST;
assert.equal(isArchivedUrl("https://thumbs.example.com/thumbs/1.jpg"), false, "no R2 host configured -> not archived");
console.log("ok  isArchivedUrl / isVercelBlobUrl");
