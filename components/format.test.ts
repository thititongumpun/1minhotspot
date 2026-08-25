// Self-check, no framework: `rtk pnpm exec tsx components/format.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Pin the host TZ before formatDate is ever called: formatDate hardcodes
// Asia/Bangkok internally, but this test's own boundary case (a UTC instant
// that is already the next day in Bangkok) only proves anything if the
// process TZ is provably NOT Bangkok. Locking to UTC means this test fails
// honestly on a Bangkok dev box if the timeZone option is ever removed,
// instead of accidentally passing because the box happens to be UTC+7.
process.env.TZ = "UTC";

// Same trick for the locale, one level up: ICU reads the default locale once at
// process start, so unlike TZ it cannot be pinned by assignment here. Re-exec
// ourselves once under a deliberately non-Thai locale (carrying execArgv so the
// tsx loader survives) — that way formatViews' hardcoded "th-TH" is what makes
// the Thai assertions below pass, not the dev box happening to be th_TH.
if (!process.env.FORMAT_TEST_LOCALE_PINNED) {
  const { status } = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: {
      ...process.env,
      LC_ALL: "en_US.UTF-8",
      LANG: "en_US.UTF-8",
      FORMAT_TEST_LOCALE_PINNED: "1",
    },
  });
  process.exit(status ?? 1);
}

import { formatDate, formatTimecode, formatViews, isoDuration, railFill } from "./format";

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

  // The magnitude words are the point: th-TH's *short* compact form is "12.3K",
  // so a Latin letter anywhere in this output means compactDisplay was lost.
  assert.equal(formatViews(12345), "1.2 หมื่นครั้ง");
  assert.equal(formatViews(1200), "1.2 พันครั้ง");
  assert.equal(formatViews(120000), "1.2 แสนครั้ง");
  assert.equal(formatViews(1234567), "1.2 ล้านครั้ง");
  // Under 1000 there is no magnitude word, so the unit needs its own space.
  assert.equal(formatViews(999), "999 ครั้ง");
  assert.equal(formatViews(0), "0 ครั้ง");
  assert.ok(!/[A-Za-z]/.test(formatViews(12345)), "formatViews must not emit K/M");
  // Host locale is pinned to en_US by the re-exec at the top of this file:
  // these strings prove formatViews carries its own "th-TH", nothing inherited.
  assert.equal(Intl.NumberFormat().resolvedOptions().locale, "en-US");
  console.log("ok  formatViews: Thai magnitude words, host-locale-independent");

  assert.equal(isoDuration(47), "PT47S");
  assert.equal(isoDuration(63), "PT1M3S");
  assert.equal(isoDuration(60), "PT1M");
  assert.equal(isoDuration(0), "PT0S");
  console.log("ok  isoDuration: PT47S / PT1M3S / PT1M / PT0S");
}

main();
