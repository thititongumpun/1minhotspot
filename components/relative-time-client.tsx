"use client";
import { useEffect, useState } from "react";
import { formatRelative } from "./format";

/**
 * `initial` is the label the server rendered, so hydration matches byte for
 * byte; only after mount does the browser clock take over. Do NOT replace it
 * with suppressHydrationWarning: React would then keep the stale server text
 * while believing the client value is already on screen, and the first tick
 * (same value) would never patch the DOM.
 */
export function RelativeTimeClient({ iso, initial, className }: { iso: string; initial: string; className?: string }) {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={iso} className={className}>
      {now ? formatRelative(iso, now) : initial}
    </time>
  );
}
