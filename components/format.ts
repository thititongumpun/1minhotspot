/** `0:47` — minutes:seconds, mono numerals, no padding on minutes. */
export function formatTimecode(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Thai Buddhist-era date (`21 สิงหาคม 2569`).
 * Verified against Intl.DateTimeFormat directly — see components/format.test.ts.
 */
export function formatDate(iso: string): string {
  const fmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
    // Without this, the date rolls over at the HOST's midnight, not
    // Bangkok's — a UTC dev box or a US-region server would show the wrong
    // day for anything published in the evening, Bangkok time.
    timeZone: "Asia/Bangkok",
  });
  return fmt.format(new Date(iso));
}

/** `numeric: "auto"` is what turns -1 day into "เมื่อวาน" rather than
 *  "1 วันที่แล้ว". Locale pinned to "th" for the same reason formatDate pins
 *  its timeZone: the host default would render this in English. */
const relativeFormat = new Intl.RelativeTimeFormat("th", { numeric: "auto" });

/**
 * "3 ชั่วโมงที่แล้ว" — recency, server-rendered.
 *
 * ponytail: the pages that render this revalidate hourly, so the string is
 * stale by up to 1h — one bucket at hour granularity, which self-corrects on
 * the next revalidate. Every call site wraps it in <time dateTime={iso}>, so
 * the exact instant is always in the markup for machines. If minute-accurate
 * recency is ever needed, that is a client component with a tick, not a
 * shorter revalidate.
 *
 * Past a week the relative form stops helping ("47 วันที่แล้ว" is not a date),
 * so it falls back to formatDate's Buddhist-era date.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  // Clamped at 0: a clip whose publishedAt is seconds in the future (clock skew
  // between Facebook and us) must never render "ในอีก 2 นาที".
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 60) return relativeFormat.format(-mins, "minute");
  if (mins < 60 * 24) return relativeFormat.format(-Math.round(mins / 60), "hour");
  if (mins < 60 * 24 * 7) return relativeFormat.format(-Math.round(mins / 1440), "day");
  return formatDate(iso);
}

/**
 * Thai-reader view count (`1.2 หมื่นครั้ง`). Intl's own compact notation does
 * the whole ladder — hand-rolling K/M would be both wrong for this audience
 * (Thai counts in พัน/หมื่น/แสน/ล้าน, not thousands/millions) and a second
 * rounding rule to keep in sync.
 *
 * `compactDisplay: "long"` is the load-bearing option: th-TH's *short* compact
 * form is CLDR's "1.2K", i.e. Latin letters on an all-Thai page. The locale is
 * pinned to "th-TH" for the same reason formatDate pins its timeZone — the
 * host default would render this in English on any non-Thai box.
 *
 * The unit word attaches directly to a Thai magnitude word (`หมื่นครั้ง`) but
 * needs a space after a bare numeral (`999 ครั้ง`), which is what the
 * trailing-digit test picks apart.
 */
const viewsFormat = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  compactDisplay: "long",
  maximumFractionDigits: 1,
});

export function formatViews(n: number): string {
  const compact = viewsFormat.format(Math.max(0, Math.round(n)));
  return /\d$/.test(compact) ? `${compact} ครั้ง` : `${compact}ครั้ง`;
}

/** The signature hot-rail fill: min(durationSec/60, 1) * 100%, as a CSS percentage. */
export function railFill(sec: number): string {
  return `${Math.round(Math.min(Math.max(sec, 0) / 60, 1) * 100)}%`;
}

/**
 * ISO-8601 duration for JSON-LD, e.g. `PT47S` / `PT1M3S`. Clips are reel-length
 * (<=90s per SPEC), so hours are never emitted — add an H component if that cap changes.
 */
export function isoDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mPart = m > 0 ? `${m}M` : "";
  const sPart = r > 0 || m === 0 ? `${r}S` : "";
  return `PT${mPart}${sPart}`;
}
