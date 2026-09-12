import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClipsByCategory } from "@/lib/clips";
import { absoluteUrl, breadcrumbJsonLd, collectionPageJsonLd, MAX_DESCRIPTION, pageOpenGraph } from "@/lib/seo";
import { truncate } from "@/lib/normalize";
import { CATEGORIES, type CategorySlug } from "@/lib/types";
import { ClipCard } from "@/components/clip-card";
import { JsonLd } from "@/components/json-ld";
import { SectionHead } from "@/components/section-head";

export const revalidate = 3600;

// Cards shown per category page. Every thumbnail below the fold is already
// loading="lazy", so the cost of an uncapped list is HTML/DOM weight, not image
// bytes: ~100 cards per category from the 500-row cache. The full feed lives on
// /videos, which already paginates.
// ponytail: fixed cap + link out; copy /videos ?page= pagination if a category
// ever needs more than /videos can absorb.
const MAX_CARDS = 24;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[category]">): Promise<Metadata> {
  const { category } = await params;
  const found = CATEGORIES.find((c) => c.slug === category);
  if (!found) return {};

  return {
    title: `${found.label}วันนี้ — คลิปข่าวสั้น`,
    description: truncate(found.intro, MAX_DESCRIPTION),
    alternates: { canonical: absoluteUrl(`/category/${category}`) },
    openGraph: pageOpenGraph(absoluteUrl(`/category/${category}`)),
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/category/[category]">) {
  const { category } = await params;
  const found = CATEGORIES.find((c) => c.slug === category);
  if (!found) notFound();

  const clips = await getClipsByCategory(category as CategorySlug);
  const shown = clips.slice(0, MAX_CARDS);
  const label = found.label;

  return (
    <section className="container-hot py-8 lg:py-12">
      <JsonLd
        data={[
          collectionPageJsonLd({
            name: `${label}วันนี้ — คลิปข่าวสั้น`,
            description: truncate(found.intro, MAX_DESCRIPTION),
            path: `/category/${category}`,
            clips: shown,
          }),
          breadcrumbJsonLd([
            { name: "หน้าแรก", url: absoluteUrl("/") },
            { name: label, url: absoluteUrl(`/category/${category}`) },
          ]),
        ]}
      />
      <nav aria-label="เส้นทางนำทาง" className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="whitespace-nowrap text-muted hover:text-hot">
          หน้าแรก
        </Link>
        <span aria-hidden className="text-muted">
          ›
        </span>
        <span className="whitespace-nowrap text-fg" aria-current="page">
          {label}
        </span>
      </nav>

      <SectionHead kicker={`หมวด ${label}`} heading={label} as="h1" />
      <p className="mt-4 max-w-[68ch] text-muted">{found.intro}</p>
      <p className="timecode mt-4">ทั้งหมด {clips.length} คลิป</p>

      {clips.length === 0 ? (
        <p className="mt-8 text-muted">ยังไม่มีคลิปข่าวในหมวดนี้</p>
      ) : (
        <>
          <h2 className="rule mt-8 pt-6 font-display text-xl font-bold text-fg">ล่าสุด</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
            {shown.map((clip, i) => (
              // The first card is this page's LCP — every other one is a scroll
              // away. Only index 0: at lg the top row holds three, but preloading
              // all three would spend a phone's first bytes on two images that
              // are below the fold at that width.
              <ClipCard key={clip.id} clip={clip} eager={i === 0} />
            ))}
          </div>
          {clips.length > shown.length && (
            <p className="mt-8">
              <Link href="/videos" className="text-sm font-medium text-hot hover:underline">
                ดูทั้งหมด →
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
