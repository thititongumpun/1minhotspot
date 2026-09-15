import Link from "next/link";
import type { Clip } from "@/lib/types";
import { formatTimecode } from "./format";
import { RelativeTime } from "./relative-time";

/** The top strip: the five newest headlines as a vertical list — the
 *  thestandard.co "latest" pattern. Nothing scrolls sideways and nothing is
 *  hidden at any width: one column on phones, two columns from 1024px so the
 *  strip stays short above the hero. No JS. */
export function Ticker({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) return null;

  return (
    <nav aria-label="ข่าวล่าสุด" className="border-b border-hairline bg-surface">
      <div className="container-hot flex flex-col gap-1 py-3 sm:flex-row sm:gap-8">
        {/* Freshness signal: age of the newest clip, measured on the reader's
            clock — an ISR page rendered an hour ago must not claim "just now". */}
        <span className="kicker flex shrink-0 gap-1.5 pb-1 whitespace-nowrap sm:w-36 sm:flex-col sm:gap-0 sm:pt-3 sm:pb-0">
          อัปเดตล่าสุด
          <RelativeTime iso={clips[0].publishedAt} className="text-hot" />
        </span>
        <ul className="grid min-w-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
          {clips.slice(0, 5).map((clip) => (
            <li key={clip.id} className="min-w-0 border-t border-hairline first:border-t-0 lg:nth-[2]:border-t-0">
              <Link
                href={`/news/${clip.slug}`}
                className="tap headline-wrap w-full gap-3 text-base text-fg transition-colors hover:text-hot"
              >
                <span className="timecode shrink-0">{formatTimecode(clip.durationSec)}</span>
                <span className="line-clamp-2 font-medium">{clip.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
