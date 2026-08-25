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
