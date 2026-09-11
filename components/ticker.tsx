import Link from "next/link";
import type { Clip } from "@/lib/types";
import { formatTimecode } from "./format";
import { RelativeTime } from "./relative-time";

/** The top strip: latest headlines, horizontal scroll-snap. CSS only — no JS marquee, no autoplay. */
export function Ticker({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) return null;

  return (
    <nav aria-label="ข่าวล่าสุด" className="border-b border-hairline bg-surface">
      <div className="container-hot flex items-center gap-4 py-2.5">
        {/* Freshness signal: age of the newest clip, measured on the reader's
            clock — an ISR page rendered an hour ago must not claim "just now". */}
        <span className="kicker flex shrink-0 flex-col whitespace-nowrap sm:flex-row sm:gap-1.5">
          อัปเดตล่าสุด
          <RelativeTime iso={clips[0].publishedAt} className="text-hot" />
        </span>
        <ul className="flex min-w-0 flex-1 snap-x snap-mandatory gap-6 overflow-x-auto">
          {clips.map((clip) => (
            <li key={clip.id} className="shrink-0 snap-start">
              <Link
                href={`/news/${clip.slug}`}
                className="flex items-center gap-2 py-1 text-sm whitespace-nowrap text-fg transition-colors hover:text-hot"
              >
                <span className="timecode">{formatTimecode(clip.durationSec)}</span>
                <span>{clip.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
