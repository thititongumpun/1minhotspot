import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClips } from "@/lib/clips";
import { absoluteUrl, breadcrumbJsonLd, pageOpenGraph } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { RundownRow } from "@/components/rundown-row";
import { SectionHead } from "@/components/section-head";

// ponytail: reading searchParams opts this route into request-time rendering
// (page.md: "searchParams is a Request-time API"), so revalidate no longer
// gives it a static shell. It stays cheap because getClips() rides load()'s
// hour-long Data Cache — the render is a slice of an already-cached array, not
// a Neon read. If this ever shows up in function time, move to
// /videos/page/[n] segments with generateStaticParams.
export const revalidate = 3600;

const PER_PAGE = 100;

/** `?page=` -> a 1-based page number, or 1. A junk value is page 1, not a 404:
 *  a crawler following a mangled link should land on the list, not an error. */
function pageNumber(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Page 1 canonicalises to the bare /videos — ?page=1 and /videos are the same
 *  list, and emitting two URLs for it is exactly the duplicate-canonical
 *  problem the audit is fixing elsewhere. */
const pagePath = (page: number) => (page <= 1 ? "/videos" : `/videos?page=${page}`);

/** absoluteUrl() percent-encodes each `/`-segment, so it would turn "?" and "="
 *  into %3F/%3D (verified: absoluteUrl("/videos?page=2") ===
 *  ".../videos%3Fpage%3D2"). Encode the path, then append the query by hand. */
const pageUrl = (page: number) =>
  page <= 1 ? absoluteUrl("/videos") : `${absoluteUrl("/videos")}?page=${page}`;

export async function generateMetadata({ searchParams }: PageProps<"/videos">): Promise<Metadata> {
  const page = pageNumber((await searchParams).page);
  const total = Math.max(1, Math.ceil((await getClips()).length / PER_PAGE));
  return {
    title: page > 1 ? `คลิปข่าวทั้งหมด — หน้า ${page}` : "คลิปข่าวทั้งหมด",
    description:
      "รวมคลิปข่าวสั้นทั้งหมดจากสรุปข่าวร้อนใน 1 นาที เรียงจากใหม่ไปเก่า ครบทุกหมวดข่าว",
    alternates: { canonical: pageUrl(page) },
    openGraph: pageOpenGraph(pageUrl(page)),
    // Next 16 emits <link rel="prev"/"next"> from this (metadata-interface.d.ts).
    pagination: {
      previous: page > 1 ? pageUrl(page - 1) : null,
      next: page < total ? pageUrl(page + 1) : null,
    },
  };
}

export default async function VideosPage({ searchParams }: PageProps<"/videos">) {
  const page = pageNumber((await searchParams).page);
  const clips = await getClips();
  const total = Math.max(1, Math.ceil(clips.length / PER_PAGE));
  // Out of range is a real 404: an empty page-9 would be a soft 404 Google
  // indexes and then flags.
  if (page > total) notFound();
  const shown = clips.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <section className="container-hot py-8 lg:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "หน้าแรก", url: absoluteUrl("/") },
          { name: "คลิปทั้งหมด", url: absoluteUrl("/videos") },
        ])}
      />
      <nav aria-label="เส้นทางนำทาง" className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="whitespace-nowrap text-muted hover:text-hot">
          หน้าแรก
        </Link>
        <span aria-hidden className="text-muted">
          ›
        </span>
        <span className="whitespace-nowrap text-fg" aria-current="page">
          คลิปทั้งหมด
        </span>
      </nav>

      <SectionHead kicker="คลิปทั้งหมด" heading="คลิปข่าวทั้งหมด" as="h1" />
      <p className="timecode mt-4">
        ทั้งหมด {clips.length} คลิป · หน้า {page} จาก {total}
      </p>

      <ol aria-label="คลิปข่าวทั้งหมด" className="mt-6 divide-y divide-hairline">
        {shown.map((clip, i) => (
          // Index stays globally 1-based across pages: it is the rundown
          // position in the whole list, not a position on this page.
          <RundownRow key={clip.id} clip={clip} index={(page - 1) * PER_PAGE + i + 1} />
        ))}
      </ol>

      {(page > 1 || page < total) && (
        <nav aria-label="แบ่งหน้า" className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pagePath(page - 1)} rel="prev" className="inline-block py-2 text-hot hover:underline">
              หน้าก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          {page < total ? (
            <Link href={pagePath(page + 1)} rel="next" className="inline-block py-2 text-hot hover:underline">
              หน้าถัดไป
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
