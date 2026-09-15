import type { CSSProperties } from "react";
import Image from "next/image";
import { preload } from "react-dom";
import { heroThumbUrl } from "@/lib/thumb-blob";
import Link from "next/link";
import type { Clip } from "@/lib/types";
import { formatDate, formatTimecode, railFill } from "./format";

/** THE LEAD: one dominant story, full-bleed 16:9 still, scrim, headline bottom-left. Never a carousel. */
export function LeadStory({
  clip,
  as: Heading = "h2",
}: {
  clip: Clip;
  as?: "h1" | "h2";
}) {
  // self-start: the lead is a fixed 16:9, so left to stretch it would grow to
  // the rundown column's height and the scrim would paint that overhang solid
  // ink — a black band under the still with the headline floating at its foot.
  // The LCP. Without a preload the request only starts once the parser reaches
  // the <img>, ~100 ms after the fonts; a hoisted <link rel=preload> puts it
  // in the first wave. (Next 16's `priority` no longer does this reliably.)
  const src = heroThumbUrl(clip.thumbnail.url);
  preload(src, { as: "image", fetchPriority: "high" });
  return (
    <Link href={`/news/${clip.slug}`} className="on-dark group relative block self-start">
      {/* The 960px sibling: the lead never renders wider than ~744 CSS px. */}
      <Image
        src={src}
        alt={clip.title}
        width={1280}
        height={720}
        // Next 16 deprecated `priority`: it only preloads now and leaves the
        // <img> lazy, so the LCP element still waited on parser discovery.
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1024px) 60vw, 100vw"
        // ponytail: 4:5 on phones so a four-line Thai headline fits inside the overlay; the still is 1080x1920 so the portrait crop shows more image, not less.
        className="aspect-[4/5] w-full bg-surface object-cover sm:aspect-video"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-transparent"
      />
      <span
        aria-hidden
        className="hot-rail absolute inset-x-0 bottom-0 z-10"
        style={{ "--fill": railFill(clip.durationSec) } as CSSProperties}
      />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <p className="kicker">ข่าวเด่น</p>
        <Heading className="headline-wrap mt-2 font-display text-2xl font-bold text-fg sm:text-4xl">
          {clip.title}
        </Heading>
        <p className="timecode mt-2 flex items-center gap-1.5">
          <time dateTime={clip.publishedAt}>{formatDate(clip.publishedAt)}</time>
          <span aria-hidden>·</span>
          {formatTimecode(clip.durationSec)}
        </p>
      </div>
    </Link>
  );
}
