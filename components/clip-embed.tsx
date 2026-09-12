"use client";

import Image from "next/image";
import { useState } from "react";

type Poster = { url: string; width: number; height: number };

/** Responsive reel embed. Facebook and YouTube URLs both arrive normalized in `clip.embedUrl`.
 *
 *  Click-to-play facade: the iframe does not exist until the visitor asks for
 *  it. Facebook's plugin pulls ~1.8 MB of script and media, which used to land
 *  on the article's critical path for every reader — including the ones who
 *  came to read. The poster below is the real LCP element, so the page is
 *  complete without the embed ever mounting. */
export function ClipEmbed({ src, title, poster }: { src: string; title: string; poster?: Poster }) {
  const isFacebook = src.includes("facebook.com");
  const embedSrc = isFacebook ? withWidth(src, 320) : src;
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  return (
    <div
      className={`on-dark relative w-full overflow-hidden bg-surface ${isFacebook ? "aspect-[9/16]" : "aspect-video"}`}
    >
      {/* Hoisted to <head> by React, and rendered in BOTH states on purpose:
          the point of the facade is that the handshake to the embed origin is
          already warm when the click arrives, so the iframe starts fetching
          instantly instead of paying DNS+TLS at exactly the wrong moment. */}
      <link rel="preconnect" href={new URL(embedSrc).origin} />
      <link
        rel="preconnect"
        href={isFacebook ? "https://static.xx.fbcdn.net" : "https://i.ytimg.com"}
        crossOrigin=""
      />

      {/* The reel's own frame, under the iframe: it is the article's real
          <img> (Discover ranks on it) and the poster while the embed loads,
          instead of a second copy of the same frame stacked above the player. */}
      {poster ? (
        <Image
          src={poster.url}
          width={poster.width}
          height={poster.height}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
      ) : null}

      {playing ? (
        <>
          {/* No lazy-loading attribute here: the iframe now only exists after a click, so
              deferring its fetch would only add latency to the one moment the
              visitor is waiting for it. The ~1.8 MB Facebook pulls is no longer
              on the article's critical path at all — that was the point. */}
          <iframe
            src={withAutoplay(embedSrc, isFacebook)}
            title={title}
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            onLoad={() => setReady(true)}
            className="absolute inset-0 h-full w-full border-0"
          />

          {/* After the iframe in the DOM, so it paints over it without a
              z-index. Only covers the click→load gap; the iframe is created
              after hydration now, so onLoad always fires and no timer is
              needed to clear it. */}
          {ready ? null : (
            <div className="skeleton embed-skeleton pointer-events-none" aria-hidden>
              <span className="embed-skeleton-play" />
              <span className="timecode relative">กำลังโหลดคลิป</span>
            </div>
          )}
        </>
      ) : (
        // A native <button> is keyboard-focusable and fires on Enter/Space with
        // no handler of ours — do not swap this for a div with key handlers.
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`เล่นคลิป: ${title}`}
          className="group absolute inset-0 flex items-center justify-center bg-ink/20 transition-colors hover:bg-ink/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
        >
          <span aria-hidden className="embed-skeleton-play" />
        </button>
      )}
    </div>
  );
}

/** The Facebook video plugin defaults to a 500px box without an explicit
 *  `width`. 320 matches the narrowest real box this embed ever renders in
 *  (the 320px mobile floor) — the plugin scales down from there, so a
 *  larger request here only wastes bytes on a box that never grows past it. */
function withWidth(src: string, width: number) {
  const url = new URL(src);
  url.searchParams.set("width", String(width));
  return url.toString();
}

/** Only ever applied to the ACTIVATED src — never on first paint, where an
 *  autoplaying embed would be exactly the thing this facade removes. */
function withAutoplay(src: string, isFacebook: boolean) {
  const url = new URL(src);
  url.searchParams.set("autoplay", isFacebook ? "true" : "1");
  return url.toString();
}
