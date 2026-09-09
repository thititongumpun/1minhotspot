"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Poster = { url: string; width: number; height: number };

/** Responsive reel embed. Facebook and YouTube URLs both arrive normalized in `clip.embedUrl`. */
export function ClipEmbed({ src, title, poster }: { src: string; title: string; poster?: Poster }) {
  const isFacebook = src.includes("facebook.com");
  const embedSrc = isFacebook ? withWidth(src, 320) : src;
  const [loaded, setLoaded] = useState(false);

  // The iframe can finish loading before React hydrates and attaches onLoad;
  // that event is then lost and the skeleton would sit there for good. The
  // overlay is pointer-events-none, so even in that window the embed stays
  // usable — this only bounds how long the placeholder is drawn over it.
  // ponytail: fixed ceiling, since no third-party embed reports readiness
  // cross-origin. Raise it if a slow embed ever pops in after the fade.
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface ${isFacebook ? "aspect-[9/16]" : "aspect-video"}`}
    >
      {/* Hoisted to <head> by React. The embed's own scripts and assets come
          from a second origin, so the handshake starts before the iframe does. */}
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

      <iframe
        src={embedSrc}
        title={title}
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        loading="lazy" // Facebook pulls ~1.8 MB; competing with poster for LCP (poster covers first paint)
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* After the iframe in the DOM, so it paints over it without a z-index. */}
      {loaded ? null : (
        <div className="skeleton embed-skeleton pointer-events-none" aria-hidden>
          <span className="embed-skeleton-play" />
          <span className="timecode relative">กำลังโหลดคลิป</span>
        </div>
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
