import type { Metadata } from "next";
import {
  getClipsByCategory,
  getLatest,
  getLeadAndRundown,
  getMostViewedThisMonth,
} from "@/lib/clips";
import { CATEGORIES } from "@/lib/types";
import { absoluteUrl, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { ClipCard } from "@/components/clip-card";
import { JsonLd } from "@/components/json-ld";
import { LeadStory } from "@/components/lead-story";
import { MostViewed } from "@/components/most-viewed";
import { RundownRow } from "@/components/rundown-row";
import { SectionHead } from "@/components/section-head";
import { Ticker } from "@/components/ticker";

export const revalidate = 3600;

export const metadata: Metadata = {
  // absolute: the home title already carries the brand; the layout template would double it.
  title: { absolute: "ข่าววันนี้ทุกหมวด | สรุปข่าวร้อนใน 1 นาที" },
  description:
    "รวมคลิปข่าวสั้นรอบวัน อัปเดตไว จบในนาทีเดียว ทันทุกกระแสสังคม บันเทิง การเมือง เศรษฐกิจ และไวรัล",
  alternates: { canonical: absoluteUrl("/") },
};

export default async function Home() {
  const [tickerClips, { lead, subs, rundown }, mostViewed, categoryClips] = await Promise.all([
    getLatest(5),
    getLeadAndRundown(),
    getMostViewedThisMonth(5),
    Promise.all(CATEGORIES.map((c) => getClipsByCategory(c.slug))),
  ]);

  return (
    <>
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />

      <Ticker clips={tickerClips} />

      <section className="container-hot py-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <LeadStory clip={lead} as="h1" />
            {subs.length > 0 && (
              <div className="rule mt-8 grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 lg:gap-8">
                {subs.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} />
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionHead kicker="01 — ข่าวกำลังมา" heading="รันดาวน์วันนี้" />
            <ol aria-label="รันดาวน์วันนี้" className="mt-4 divide-y divide-hairline">
              {rundown.map((clip, i) => (
                <RundownRow key={clip.id} clip={clip} index={i + 1} />
              ))}
            </ol>
          </div>
        </div>
      </section>

      <MostViewed clips={mostViewed} />

      {CATEGORIES.map((cat, i) => {
        const clips = categoryClips[i].slice(0, 4);
        if (clips.length === 0) return null;

        return (
          <section key={cat.slug} className="container-hot py-8 lg:py-12">
            <SectionHead
              kicker={`หมวด ${cat.label}`}
              heading={cat.label}
              seeAllHref={`/category/${cat.slug}`}
              seeAllLabel="ดูทั้งหมด"
            />
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
