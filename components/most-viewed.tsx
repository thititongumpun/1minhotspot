import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { categoryLabel, type Clip } from "@/lib/types";
import { formatViews, railFill } from "./format";
import { SectionHead } from "./section-head";

/* Hallmark · pre-emit critique: P5 H5 E4 S4 R5 V4
 * component: ranked list section · genre: editorial · theme: 1minhotspot (in-place)
 * states: default · hover · focus-visible · empty (renders nothing)
 * contrast: pass — amber-on-ink and fg-on-ink are the site's existing pairs
 */

/**
 * The view count is the reason this section exists, so it — not a 01/02 index —
 * carries the rank. #1 gets a still and a display-scale numeral; #2 down are a
 * thumbnail-free ledger whose fixed numeral column lets the counts read as a
 * descending column at a glance. Deliberately neither the RundownRow rhythm
 * (numbered index + thumb) nor the 4-up ClipCard grid.
 */
export function MostViewed({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) return null;

  const [lead, ...rest] = clips;

  return (
    <section className="container-hot py-8 lg:py-12">
      <SectionHead kicker="ยอดวิวสูงสุดเดือนนี้" heading="ดูมากที่สุดเดือนนี้" />

      <ol
        aria-label="คลิปที่มีคนดูมากที่สุดในเดือนนี้ เรียงจากยอดวิวสูงสุด"
        className="mt-6 divide-y divide-hairline"
      >
        <li className="pb-6">
          <Link
            href={`/news/${lead.slug}`}
            className="group grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6"
          >
            <div className="min-w-0">
              <Image
                src={lead.thumbnail.url}
                alt={lead.title}
                width={640}
                height={360}
                // The lead sits in a half-width track at 1240px (~580px), and
                // this section is always below the fold — never eager.
                sizes="(min-width: 1024px) 580px, (min-width: 640px) 50vw, 100vw"
                className="aspect-video w-full bg-surface object-cover"
              />
              <span
                aria-hidden
                className="hot-rail"
                style={{ "--fill": railFill(lead.durationSec) } as CSSProperties}
              />
            </div>

            <div className="min-w-0">
              {lead.views !== undefined && (
                <p className="font-mono text-3xl leading-none font-medium tabular-nums text-hot sm:text-4xl lg:text-5xl">
                  <span className="sr-only">ยอดวิว </span>
                  {formatViews(lead.views)}
                </p>
              )}
              <p className="headline-wrap mt-3 font-display text-lg font-bold text-fg group-hover:text-hot sm:text-xl lg:text-2xl">
                {lead.title}
              </p>
              <p className="kicker mt-3">{categoryLabel(lead.category)}</p>
            </div>
          </Link>
        </li>

        {rest.map((clip) => (
          <li key={clip.id}>
            <Link
              href={`/news/${clip.slug}`}
              className="group flex items-baseline gap-3 py-4 sm:gap-5"
            >
              {/* Fixed width even when the count is missing: the numerals only
                  read as a ranked column if the headlines stay flush. Sized for
                  the longest string formatViews can emit, not today's 3-4 digit
                  counts — at 10k+ it returns `1.2 หมื่นครั้ง`, which needs room
                  a 6.5rem track only just has. nowrap because a numeral that
                  wrapped to two lines would break the baseline ledger outright.
                  At 320px this still leaves the headline ~148px to wrap in. */}
              <span className="w-30 shrink-0 whitespace-nowrap font-mono text-base font-medium tabular-nums text-hot sm:w-36 sm:text-lg">
                {clip.views !== undefined && (
                  <>
                    <span className="sr-only">ยอดวิว </span>
                    {formatViews(clip.views)}
                  </>
                )}
              </span>
              <span className="headline-wrap min-w-0 flex-1 font-display text-sm font-bold text-fg group-hover:text-hot sm:text-base">
                {clip.title}
              </span>
              <span className="kicker hidden shrink-0 sm:block">
                {categoryLabel(clip.category)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
