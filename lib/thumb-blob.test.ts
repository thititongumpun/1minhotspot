// Self-check: pnpm exec tsx lib/thumb-blob.test.ts. Exits 0 when green. No network.
import assert from "node:assert/strict";
import { isArchivedUrl, isPlaceholderStill, isVercelBlobUrl, largestFormat, smallThumbUrl, heroThumbUrl, heroSiblingUrl } from "./thumb-blob";
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

// Facebook's generic "no still available" placeholder: landscape, unlike every
// real reel format (always native 1080x1920 portrait).
const placeholderOnly = [
  { filter: "placeholder", picture: "https://scontent-bkk1-1.xx.fbcdn.net/placeholder.jpg", width: 160, height: 120 },
];
assert.equal(largestFormat(placeholderOnly), null, "landscape-only formats -> null, never archived");
assert.equal(
  largestFormat([...placeholderOnly, ...formats])!.width,
  1080,
  "a landscape placeholder must not beat a real portrait format",
);
console.log("ok  largestFormat: rejects the landscape placeholder format");

process.env.R2_PUBLIC_HOST = "thumbs.example.com";
assert.equal(isArchivedUrl("https://thumbs.example.com/thumbs/1.jpg"), true, "R2 host is archived");
assert.equal(isArchivedUrl("https://abc.public.blob.vercel-storage.com/thumbs/1.jpg"), true, "retired Blob host still archived");
assert.equal(isArchivedUrl("https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0"), false);
assert.equal(isArchivedUrl("not a url"), false, "a malformed URL must not throw");
assert.equal(isVercelBlobUrl("https://abc.public.blob.vercel-storage.com/thumbs/1.jpg"), true);
assert.equal(isVercelBlobUrl("https://thumbs.example.com/thumbs/1.jpg"), false, "R2 rows are not --force targets");

assert.equal(smallThumbUrl("https://thumbs.example.com/thumbs/123.jpg"), "https://thumbs.example.com/thumbs/123-640.webp");
assert.equal(smallThumbUrl("https://abc.public.blob.vercel-storage.com/thumbs/123.jpg"), "https://abc.public.blob.vercel-storage.com/thumbs/123.jpg", "retired Blob rows have no sibling");
assert.equal(smallThumbUrl("https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0"), "https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0", "fbcdn rows have no sibling");
assert.equal(smallThumbUrl("https://thumbs.example.com/other/123.jpg"), "https://thumbs.example.com/other/123.jpg", "only the thumbs/ prefix has siblings");
assert.equal(smallThumbUrl("not a url"), "not a url", "a malformed URL must not throw");
assert.equal(smallThumbUrl("https://thumbs.example.com/thumbs/123-640.webp"), "https://thumbs.example.com/thumbs/123-640.webp", "idempotent: a small URL is not re-derived");
console.log("ok  smallThumbUrl: R2 large -> sibling, everything else untouched");

assert.equal(heroThumbUrl("https://thumbs.example.com/thumbs/123.jpg"), "https://thumbs.example.com/thumbs/123.jpg", "HERO_THUMBS unset -> the large JPG, never a 404 sibling");
process.env.HERO_THUMBS = "1";
assert.equal(heroThumbUrl("https://thumbs.example.com/thumbs/123.jpg"), "https://thumbs.example.com/thumbs/123-960.webp");
assert.equal(heroThumbUrl("https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0"), "https://scontent-bkk1-1.xx.fbcdn.net/v/t15/1.jpg?oe=68B0", "fbcdn rows have no hero sibling");
delete process.env.HERO_THUMBS;
assert.equal(heroSiblingUrl("https://thumbs.example.com/thumbs/123.jpg"), "https://thumbs.example.com/thumbs/123-960.webp", "the backfill key is not gated");
console.log("ok  heroThumbUrl: gated on HERO_THUMBS, same convention at 960");

delete process.env.R2_PUBLIC_HOST;
assert.equal(isArchivedUrl("https://thumbs.example.com/thumbs/1.jpg"), false, "no R2 host configured -> not archived");
console.log("ok  isArchivedUrl / isVercelBlobUrl");

// fbcdn's "still not rendered yet" placeholder: a 160x120 GIF served under a
// `format` entry that still REPORTS 1080x1920, so only the bytes give it away.
const gif = new TextEncoder().encode("GIF89a\xa0\x00\x78\x00").buffer as ArrayBuffer;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]).buffer as ArrayBuffer;
assert.equal(isPlaceholderStill("image/gif", gif), true, "gif content-type -> placeholder");
assert.equal(isPlaceholderStill(null, gif), true, "GIF magic bytes -> placeholder even without a content-type");
assert.equal(isPlaceholderStill("image/jpeg", jpeg), false, "a real JPEG still is not a placeholder");
console.log("ok  isPlaceholderStill: GIF placeholder rejected, JPEG still accepted");
