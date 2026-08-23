import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClip, getClips, getClipsByCategory } from "@/lib/clips";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  clipDescription,
  newsArticleJsonLd,
  videoObjectJsonLd,
} from "@/lib/seo";
import { PLACEHOLDER } from "@/lib/normalize";
import { categoryLabel } from "@/lib/types";
import { ClipCard } from "@/components/clip-card";
import { ClipEmbed } from "@/components/clip-embed";
import { formatDate, formatTimecode, railFill } from "@/components/format";
import { JsonLd } from "@/components/json-ld";
import { SectionHead } from "@/components/section-head";

export const revalidate = 3600;

/**
 * Prerender only the recent window. The store accumulates clips forever, so
 * prerendering all of them would make build time grow without bound. Older
 * articles still resolve: `dynamicParams` defaults to true, so they render on
 * demand and are cached from then on. Never add a notFound() for a slug that
 * misses this list — serving old URLs is the entire point of the store.
 */
const PRERENDER_LIMIT = 200;

export async function generateStaticParams() {
  const clips = await getClips();
  return clips.slice(0, PRERENDER_LIMIT).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const clip = await getClip(slug);
  if (!clip) return {};

  const url = absoluteUrl(`/news/${clip.slug}`);
  const description = clipDescription(clip);

  return {
    title: clip.title,
    description,
    alternates: { canonical: url },
    // No `images` here on purpose: this segment's opengraph-image.tsx already
    // generates a correct 1200x630 16:9 card. Setting openGraph.images (or
    // twitter.images) here would override that file convention with
    // clip.thumbnail — a 1080x1920 portrait still that fails Google's Article
    // image ratio and Twitter/Facebook's ~1.91:1 card requirement.
    openGraph: {
      type: "article",
      title: clip.title,
      description,
      url,
      publishedTime: clip.publishedAt,
      modifiedTime: clip.updatedAt,
    },
    twitter: { card: "summary_large_image", title: clip.title, description },
  };
}

export default async function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  const { slug } = await params;

  const clip = await getClip(slug);
  if (!clip) notFound();

  const source = clip.sourceArticle;
  // The placeholder says "details are being checked". Once the source excerpt
  // is on the page that is no longer true, so it goes.
  const [lead, ...rest] = clip.body
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !(source && p === PLACEHOLDER));
  const related = (await getClipsByCategory(clip.category))
    .filter((c) => c.slug !== clip.slug)
    .slice(0, 4);

  const label = categoryLabel(clip.category);
  const sourceHost = new URL(clip.permalink).hostname.replace(/^www\./, "");

  return (
    <>
      <JsonLd
        data={[
          newsArticleJsonLd(clip),
          videoObjectJsonLd(clip),
          breadcrumbJsonLd([
            { name: "หน้าแรก", url: absoluteUrl("/") },
            { name: label, url: absoluteUrl(`/category/${clip.category}`) },
            { name: clip.title, url: absoluteUrl(`/news/${clip.slug}`) },
          ]),
        ]}
      />

      <article className="container-hot py-8 lg:py-12">
        <nav aria-label="เส้นทางนำทาง" className="timecode flex items-center gap-2">
          <Link href="/" className="whitespace-nowrap hover:text-hot">
            หน้าแรก
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/category/${clip.category}`}
            className="whitespace-nowrap text-hot hover:underline"
          >
            {label}
          </Link>
        </nav>

        <header className="mt-6 max-w-[68ch]">
          <p className="kicker">{label}</p>
          <h1 className="headline-wrap mt-3 font-display text-[clamp(1.75rem,4.5vw,3.5rem)] leading-[1.15] font-bold text-fg">
            {clip.title}
          </h1>
          <p className="timecode mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
            <time dateTime={clip.publishedAt}>เผยแพร่เมื่อ {formatDate(clip.publishedAt)}</time>
            <span aria-hidden>·</span>
            <span>ความยาว {formatTimecode(clip.durationSec)}</span>
          </p>
          <span
            aria-hidden
            className="hot-rail mt-3"
            style={{ "--fill": railFill(clip.durationSec) } as CSSProperties}
          />
        </header>

        {/*
          One DOM copy of the embed. Mobile is plain source order — lead, embed, rest.
          From lg up, explicit row/column placement lifts the embed into a right rail.
        */}
        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
          {lead ? (
            <p className="headline-wrap max-w-[68ch] text-lg lg:col-start-1 lg:row-start-1">
              {lead}
            </p>
          ) : null}

          <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
            <ClipEmbed src={clip.embedUrl} title={clip.title} />
            <p className="timecode mt-3">ความยาว {formatTimecode(clip.durationSec)}</p>
            <p className="mt-3 text-sm">
              <a
                href={clip.permalink}
                target="_blank"
                rel="noopener"
                className="text-hot hover:underline"
              >
                รับชมบน {sourceHost}
              </a>
            </p>
          </aside>

          {/* With a source excerpt the placeholder lead is gone, so row 1 would
              hold only the row-spanning aside and grid would hand it half the
              embed's height — push the body up into row 1 instead. */}
          <div
            className={`max-w-[68ch] space-y-5 lg:col-start-1 ${lead ? "lg:row-start-2" : "lg:row-start-1"}`}
          >
            {rest.map((paragraph, i) => (
              <p key={i} className="headline-wrap">
                {paragraph}
              </p>
            ))}

            {/*
              Quoted, never republished: the publisher's own og:description plus
              at most two paragraphs, capped at 600 characters upstream. It is
              marked as a quotation, attributed by name, and sits next to a
              visible link to the original — this is not our reporting.

              Only shown when there is no rewrite. The excerpt is a fallback for
              having nothing of our own to say; once n8n's Thai narration is the
              body, printing the source's version of the same story underneath
              is the same news twice, the second time in someone else's words.
              Attribution does not depend on this block — the แหล่งที่มา line
              below always links the publisher, as does isBasedOn in the JSON-LD.
            */}
            {source && !clip.hasScript ? (
              <figure className="mt-2">
                <p className="kicker">ข้อความจากต้นฉบับ · {source.publisher}</p>
                <blockquote
                  cite={source.url}
                  className="rule-left mt-3 border-l-2 border-l-hot"
                >
                  {source.excerpt.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="headline-wrap text-muted first:mt-0 mt-4">
                      {paragraph}
                    </p>
                  ))}
                </blockquote>
                <figcaption className="mt-3 text-sm">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener"
                    className="text-hot hover:underline"
                  >
                    อ่านต่อที่ {source.publisher}
                  </a>
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>

        <p className="rule mt-10 max-w-[68ch] pt-4 text-sm text-muted">
          แหล่งที่มา:{" "}
          <a href={clip.permalink} target="_blank" rel="noopener" className="text-hot hover:underline">
            {sourceHost}
          </a>
          {source ? (
            <>
              {" · "}
              <a href={source.url} target="_blank" rel="noopener" className="text-hot hover:underline">
                {source.publisher}
              </a>
            </>
          ) : null}
        </p>
      </article>

      {related.length > 0 ? (
        <section className="container-hot pb-12 lg:pb-16">
          <SectionHead kicker={label} heading="ข่าวที่เกี่ยวข้อง" />
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
            {related.map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
