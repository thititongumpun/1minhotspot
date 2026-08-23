import type { Metadata } from "next";
import Link from "next/link";
import { getClips } from "@/lib/clips";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { RundownRow } from "@/components/rundown-row";
import { SectionHead } from "@/components/section-head";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "คลิปข่าวทั้งหมด",
  description:
    "รวมคลิปข่าวสั้นทั้งหมดจากสรุปข่าวร้อนใน 1 นาที เรียงจากใหม่ไปเก่า ครบทุกหมวดข่าว",
  alternates: { canonical: absoluteUrl("/videos") },
};

export default async function VideosPage() {
  const clips = await getClips();

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
      <p className="timecode mt-4">ทั้งหมด {clips.length} คลิป</p>

      <ol aria-label="คลิปข่าวทั้งหมด" className="mt-6 divide-y divide-hairline">
        {clips.map((clip, i) => (
          <RundownRow key={clip.id} clip={clip} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}
