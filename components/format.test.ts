// Self-check, no framework: `rtk pnpm exec tsx components/format.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";

// Pin the host TZ before formatDate is ever called: formatDate hardcodes
// Asia/Bangkok internally, but this test's own boundary case (a UTC instant
// that is already the next day in Bangkok) only proves anything if the
// process TZ is provably NOT Bangkok. Locking to UTC means this test fails
// honestly on a Bangkok dev box if the timeZone option is ever removed,
// instead of accidentally passing because the box happens to be UTC+7.
process.env.TZ = "UTC";

import { formatDate, formatTimecode, isoDuration, railFill } from "./format";

function main() {
  assert.equal(formatTimecode(47), "0:47");
  assert.equal(formatTimecode(60), "1:00");
  assert.equal(formatTimecode(90), "1:30");
  assert.equal(formatTimecode(5), "0:05");
  console.log("ok  formatTimecode: 0:47 / 1:00 / 1:30 / 0:05");

  const iso = "2026-08-21T12:00:00.000Z";
  // Thai-only site: the Buddhist era (2569 = 2026 + 543) is the only calendar
  // this formatter may emit — a Gregorian year here would be the regression.
  assert.equal(formatDate(iso), "21 สิงหาคม 2569");
  assert.ok(!formatDate(iso).includes("2026"), "formatDate must not emit a Gregorian year");
  console.log("ok  formatDate: Buddhist era, Thai month name");

  // Boundary case: 19:30 UTC is already 02:30 the NEXT day in Bangkok
  // (UTC+7). With TZ pinned to UTC above, this only reads "22" if formatDate
  // actually converts to Asia/Bangkok instead of formatting in the host TZ.
  assert.equal(formatDate("2026-08-21T19:30:00Z"), "22 สิงหาคม 2569");
  console.log("ok  formatDate: converts to Asia/Bangkok regardless of host TZ (UTC 19:30 -> next day)");

  assert.equal(railFill(30), "50%");
  assert.equal(railFill(60), "100%");
  assert.equal(railFill(90), "100%");
  assert.equal(railFill(0), "0%");
  console.log("ok  railFill: min(sec/60,1)*100%");

  assert.equal(isoDuration(47), "PT47S");
  assert.equal(isoDuration(63), "PT1M3S");
  assert.equal(isoDuration(60), "PT1M");
  assert.equal(isoDuration(0), "PT0S");
  console.log("ok  isoDuration: PT47S / PT1M3S / PT1M / PT0S");
}

main();
