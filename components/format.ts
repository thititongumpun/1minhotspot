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
