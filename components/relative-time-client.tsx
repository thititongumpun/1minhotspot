"use client";
import { useSyncExternalStore } from "react";
import { formatRelative } from "./format";

/* One clock for the whole page. A homepage renders ~45 of these; each used to
   own a 60 s setInterval, so 45 timers woke the main thread every minute to
   re-render text that changes hourly. Subscribers share one interval that
   stops when the last one unmounts. */
const listeners = new Set<() => void>();
let now: Date | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = new Date();
    timer = setInterval(() => {
      now = new Date();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * `initial` is the label the server rendered: getServerSnapshot returns it so
 * hydration matches byte for byte, and only after mount does the browser
 * clock (getSnapshot) take over. Do NOT replace it with
 * suppressHydrationWarning: React would then keep the stale server text
 * while believing the client value is already on screen.
 */
export function RelativeTimeClient({ iso, initial, className }: { iso: string; initial: string; className?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso, now ?? new Date()),
    () => initial,
  );
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
