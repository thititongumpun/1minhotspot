import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { categoryLabel, type Clip } from "@/lib/types";
import { formatTimecode, railFill } from "./format";
import { RelativeTime } from "./relative-time";
import { smallThumbUrl } from "@/lib/thumb-blob";

/** The reusable photo-led card used by every grid on the site. */
export function ClipCard({ clip, eager }: { clip: Clip; eager?: boolean }) {
  return (
    <Link href={`/news/${clip.slug}`} className="group block min-w-0">
      {/* The 640px WebP sibling — a listing card never renders wider than that,
          and the large object is a 1080x1920 reel still. The article poster
          (components/clip-embed.tsx), NewsArticle.image and og:image all keep
          the LARGE url: Discover ranks on it and it must stay >=1200px. */}
      <Image
        src={smallThumbUrl(clip.thumbnail.url)}
        alt={clip.title}
        width={640}
        height={360}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-video w-full bg-surface object-cover"
      />
      <span
        aria-hidden
        className="hot-rail"
        style={{ "--fill": railFill(clip.durationSec) } as CSSProperties}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="kicker">{categoryLabel(clip.category)}</span>
        <span className="timecode flex items-center gap-1.5 whitespace-nowrap">
          <RelativeTime iso={clip.publishedAt} />
          <span aria-hidden>·</span>
          {formatTimecode(clip.durationSec)}
        </span>
      </div>
      <p className="headline-wrap mt-2 font-display text-base font-bold text-fg group-hover:text-hot">
        {clip.title}
      </p>
    </Link>
  );
}
