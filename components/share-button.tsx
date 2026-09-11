"use client";
import { useEffect, useRef, useState } from "react";

// ponytail: plain share URLs, no SDKs; add share counts only if ever requested.

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
      <button type="button" aria-label="แชร์บทความนี้" className="text-hot hover:underline" onClick={share}>
        {copyState === "idle" ? "แชร์" : copyLabel}
      </button>
    );
  }

  return (
    <span className="contents">
      <a
        href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener"
        className="text-hot hover:underline"
      >
        LINE
      </a>
      <span aria-hidden>·</span>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener"
        className="text-hot hover:underline"
      >
        Facebook
      </a>
      <span aria-hidden>·</span>
      <a
        href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener"
        className="text-hot hover:underline"
      >
        X
      </a>
      <span aria-hidden>·</span>
      {/* Instagram has no web share URL, so it is omitted here. */}
      <button type="button" className="text-hot hover:underline" onClick={copyLink}>
        {copyLabel}
      </button>
    </span>
  );
}
