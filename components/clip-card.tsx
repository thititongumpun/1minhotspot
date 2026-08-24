import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { categoryLabel, type Clip } from "@/lib/types";
import { formatDate, formatTimecode, railFill } from "./format";

/** The reusable photo-led card used by every grid on the site. */
export function ClipCard({ clip, eager }: { clip: Clip; eager?: boolean }) {
  return (
    <Link href={`/news/${clip.slug}`} className="group block min-w-0">
      <Image
        src={clip.thumbnail.url}
        alt=""
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
          {formatDate(clip.publishedAt)}
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
