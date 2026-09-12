import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Clip } from "@/lib/types";
import { formatTimecode, railFill } from "./format";
import { RelativeTime } from "./relative-time";
import { smallThumbUrl } from "@/lib/thumb-blob";

/**
 * The signature numbered row: two-digit mono index, 96px thumbnail, headline
 * centre, timecode right-aligned. Text-first — deliberately not card-like.
 */
export function RundownRow({ clip, index }: { clip: Clip; index: number }) {
  return (
    <li>
      <Link href={`/news/${clip.slug}`} className="group flex items-center gap-3 py-4 sm:gap-4">
        <span className="w-6 shrink-0 font-mono text-sm font-medium tabular-nums text-hot">
          {String(index).padStart(2, "0")}
        </span>
        <Image
          src={smallThumbUrl(clip.thumbnail.url)}
          alt={clip.title}
          width={96}
          height={54}
          sizes="96px"
          className="aspect-video w-16 shrink-0 bg-surface object-cover sm:w-24"
        />
        <span className="headline-wrap min-w-0 flex-1 font-display text-base font-bold text-fg group-hover:text-hot">
          {clip.title}
        </span>
        <span className="timecode shrink-0 whitespace-nowrap">
          <RelativeTime iso={clip.publishedAt} className="hidden sm:inline" />
          <span aria-hidden className="hidden sm:inline"> · </span>
          {formatTimecode(clip.durationSec)}
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
