import { formatRelative } from "./format";
import { RelativeTimeClient } from "./relative-time-client";

/**
 * <time> whose label follows the reader's clock. The server renders its label
 * once (an ISR page can be an hour old); the client recomputes on mount and
 * every minute, so "5 นาทีที่ผ่านมา" is measured from when the page is looked
 * at, not from when it was cached.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return <RelativeTimeClient iso={iso} initial={formatRelative(iso)} className={className} />;
}
