"use client";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The strip's chrome and its three reasons to vanish: the promo window is
 * closed on the reader's clock, the reader is already on /promo/* (it would
 * link to itself), or they closed it this session. The server always renders
 * the children (getServerSnapshot → open, not dismissed) so a daily ISR page
 * cached before `startsAt` needs no regeneration and hydration matches byte
 * for byte — never suppressHydrationWarning.
 */
const KEY = "promo-dismissed";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
// Keyed by slug so the next promotion shows again after this one was closed.
const readDismissed = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function PromoGate({
  slug,
  startsAt,
  endsAt,
  children,
}: {
  slug: string;
  startsAt: string;
  endsAt: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // ponytail: mount-only check, window is days long
  const open = useSyncExternalStore(
    subscribe,
    () => {
      const t = Date.now();
      return t >= Date.parse(startsAt) && t < Date.parse(endsAt);
    },
    () => true,
  );
  const dismissed = useSyncExternalStore(subscribe, () => readDismissed() === slug, () => false);
  if (!open || dismissed || pathname.startsWith("/promo/")) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, slug);
    } catch {}
    listeners.forEach((l) => l());
  };

  return (
    // The hairline is this site's one divider (header, ticker and footer carry
    // the same): without it the strip and the home ticker read as one grey band.
    <aside aria-label="โปรโมชัน" className="border-b border-hairline bg-surface"> {/* taste-skill-ignore */}
      <div className="container-hot flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดโปรโมชัน"
          className="tap -mr-2 min-w-11 shrink-0 justify-center px-2 font-display text-2xl leading-none text-muted transition-colors hover:text-fg"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
