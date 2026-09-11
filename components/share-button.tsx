"use client";
import { useEffect, useRef, useState } from "react";

// ponytail: plain share URLs, no SDKs; add share counts only if ever requested.

const PILL =
  "inline-flex items-center gap-2 rounded-full border border-hot px-4 py-2 text-sm font-medium text-hot transition-colors hover:bg-hot hover:text-ink";

function ShareIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

/**
 * Server render and first client render both emit the fallback links (same
 * reasoning as relative-time-client.tsx): `canShare` starts false and flips
 * only after mount, so hydration matches byte for byte.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [canShare, setCanShare] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const detect = () => setCanShare(!!navigator.share);
    detect();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  async function copyLink() {
    // navigator.clipboard is undefined on http:// and writeText rejects when
    // permission is denied, so the failure must land in state, not the console.
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopyState("idle"), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      await copyLink();
    }
  }

  const copyLabel =
    copyState === "done" ? "คัดลอกลิงก์แล้ว" : copyState === "failed" ? "คัดลอกไม่สำเร็จ" : "คัดลอกลิงก์";

  if (canShare) {
    return (
      <button type="button" className={PILL} onClick={share}>
        <ShareIcon />
        {copyState === "idle" ? "แชร์ข่าวนี้" : copyLabel}
      </button>
    );
  }

  const encoded = encodeURIComponent(url);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="kicker mr-1">แชร์ข่าวนี้</span>
      <a href={`https://social-plugins.line.me/lineit/share?url=${encoded}`} target="_blank" rel="noopener" className={PILL}>
        LINE
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener" className={PILL}>
        Facebook
      </a>
      <a
        href={`https://x.com/intent/post?url=${encoded}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener"
        className={PILL}
      >
        X
      </a>
      {/* Instagram has no web share URL, so it is omitted here. */}
      <button type="button" className={PILL} onClick={copyLink}>
        {copyLabel}
      </button>
    </div>
  );
}
