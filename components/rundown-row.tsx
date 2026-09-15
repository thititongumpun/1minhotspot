import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Clip } from "@/lib/types";
import { formatTimecode, railFill } from "./format";
import { RelativeTime } from "./relative-time";
import { smallThumbUrl } from "@/lib/thumb-blob";

/**
 * The signature numbered row: two-digit index, thumbnail, headline with its
 * time and duration underneath. Text-first — deliberately not card-like.
 */
export function RundownRow({ clip, index }: { clip: Clip; index: number }) {
  return (
    <li>
      <Link href={`/news/${clip.slug}`} className="group flex items-center gap-3 py-4 sm:gap-4">
        <span className="w-6 shrink-0 font-mono text-base font-medium tabular-nums text-hot">
          {String(index).padStart(2, "0")}
        </span>
        <Image
          src={smallThumbUrl(clip.thumbnail.url)}
          alt={clip.title}
          width={96}
          height={54}
          sizes="96px"
          className="aspect-video w-20 shrink-0 bg-surface object-cover sm:w-24"
        />
        {/* Headline over meta, not beside it: a fourth column left the
            headline ~30px at 320px and in the 1024px rundown rail. */}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="headline-wrap font-display text-lg leading-snug font-bold text-fg group-hover:text-hot">
            {clip.title}
          </span>
          <span className="timecode">
            <RelativeTime iso={clip.publishedAt} />
            <span aria-hidden> · </span>
            {formatTimecode(clip.durationSec)}
          </span>
        </span>
      </Link>
      <span
        aria-hidden
        className="hot-rail"
        style={{ "--fill": railFill(clip.durationSec) } as CSSProperties}
      />
    </li>
  );
}
