import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPromotion } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageOpenGraph, SITE_NAME } from "@/lib/seo";
import type { Promotion } from "@/lib/types";
import { formatDate } from "@/components/format";
import { JsonLd } from "@/components/json-ld";
import { blocks, splitTitle } from "./parse";
import { Gallery } from "./gallery";
import s from "./page.module.css";

/**
 * Sponsored landing page for one promotion. Rendered on first request and
 * regenerated hourly (promotions change by the day, and the days-left line
 * below is computed at render), plus on demand via /api/promo-revalidate.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

/**
 * The promotion, or null when it is missing or the slug is malformed. An
 * ended one still loads: it is archived (indexed, CTAs gone), not a 404, so
 * the links already out there keep resolving.
 */
async function load(raw: string): Promise<Promotion | null> {
  try {
    return await getPromotion(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

/**
 * Whole days left to join, 0 once it has ended. Clock reads live here, not
 * in the component (react-hooks/purity). ponytail: hourly ISR, so both the
 * count and the archived view can lag real time by up to 1h.
 */
function daysLeftOf(promo: Promotion): number {
  return Math.max(0, Math.ceil((Date.parse(promo.endsAt) - Date.now()) / 86_400_000));
}

export async function generateMetadata({ params }: PageProps<"/promo/[slug]">): Promise<Metadata> {
  const promo = await load((await params).slug);
  if (!promo) return {};
  const url = absoluteUrl(`/promo/${promo.slug}`);
  const hero = promo.images[0];
  return {
    title: { absolute: `${promo.title} | ${SITE_NAME}` },
    description: promo.summary,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      ...pageOpenGraph(url),
      title: promo.title,
      description: promo.summary,
      images: hero ? [{ url: hero.url, width: hero.w, height: hero.h, alt: hero.alt }] : [],
    },
    twitter: { card: "summary_large_image", title: promo.title, description: promo.summary },
  };
}

export default async function PromoPage({ params }: PageProps<"/promo/[slug]">) {
  const promo = await load((await params).slug);
  if (!promo) notFound();

  const url = absoluteUrl(`/promo/${promo.slug}`);
  const [hero, ...rest] = promo.images;
  const [headline, statement] = splitTitle(promo.title);
  const body = blocks(promo.body);
  const lead = body[0]?.kind === "p" ? body[0].text : undefined;
  // Closing line is the body's last paragraph (how/where to join, pickup date…)
  // so the page stays brand-neutral; summary when the body ends in a list.
  const last = body.at(-1);
  const tail = body.length > 1 && last?.kind === "p" ? last : undefined;
  const middle = body.slice(lead ? 1 : 0, tail ? -1 : undefined);
  const closingText = tail?.text ?? promo.summary;
  const closing = rest[0] ?? hero;
  const daysLeft = daysLeftOf(promo);
  const ended = daysLeft === 0;
  const links = ended ? [] : promo.links;

  return (
    <div className={s.page}>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: promo.title,
            description: promo.summary,
            url,
            inLanguage: "th-TH",
            datePublished: promo.startsAt,
            ...(ended ? {} : { expires: promo.endsAt }),
            about: { "@type": "Brand", name: promo.brand },
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
            ...(hero
              ? {
                  primaryImageOfPage: {
                    "@type": "ImageObject",
                    // R2 urls are absolute already. ponytail: the "/" branch exists only
                    // for dev copies under public/promo-dev; drop it once those are gone.
                    url: hero.url.startsWith("/") ? absoluteUrl(hero.url) : hero.url,
                    width: hero.w,
                    height: hero.h,
                  },
                }
              : {}),
          },
          breadcrumbJsonLd([
            { name: "หน้าแรก", url: absoluteUrl("/") },
            { name: promo.title, url },
          ]),
        ]}
      />

      <article>
        <section className={s.hero}>
          <div className={s.heroText}>
            <h1 className={`${s.title} headline-wrap font-display font-bold text-fg`}>{headline}</h1>
            {statement && (
              <p className={`${s.statement} headline-wrap mt-4 font-display font-bold text-fg`}>{statement}</p>
            )}
            <p className="text-base text-muted">
              <Link href="/" className="tap hover:text-hot">
                หน้าแรก
              </Link>
              <span aria-hidden> / </span>
              โปรโมชัน
            </p>
            {ended && (
              <p className="mt-4 text-lg font-display font-bold" role="status">
                โปรโมชันนี้สิ้นสุดแล้ว ({formatDate(promo.endsAt)})
              </p>
            )}
            <p className="headline-wrap mt-5 max-w-[44ch] text-lg leading-[1.7] lg:mt-auto lg:pt-10">{promo.summary}</p>
            <p className="mt-4 text-lg font-display font-bold">
              ถึง <time dateTime={promo.endsAt}>{formatDate(promo.endsAt)}</time>
              {daysLeft > 0 && <span className="text-muted"> · เหลืออีก {daysLeft} วัน</span>}
            </p>
            {links.length > 0 && (
              <p className="mt-5">
                <a href="#join" className={s.button}>
                  ดูวิธีร่วมรายการ
                </a>
              </p>
            )}
          </div>
          {hero && (
            <div className={`${s.heroField} ${s.shutter}`}>
              <Image src={hero.url} alt={hero.alt} width={hero.w} height={hero.h} priority sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          )}
        </section>

        <section className="container-hot py-16 lg:py-28">
          {lead && (
            <p className={`${s.lead} ${s.intro} ${s.rise} headline-wrap font-display font-bold text-fg`}>
              {lead}
            </p>
          )}
          <div className="mt-10 space-y-5 text-lg leading-[1.75] lg:mt-14">
            {middle.map((block, i) =>
              block.kind === "p" ? (
                <p key={i} className={`${s.rise} headline-wrap max-w-[68ch]`}>
                  {block.text}
                </p>
              ) : (
                <div key={i} className="pt-10 lg:pt-20">
                  <h2 className={`${s.rise} ${s.heading} headline-wrap font-display font-bold text-fg`}>
                    {block.heading ?? "รายการ"}
                  </h2>
                  <p className="mt-2 text-lg text-muted">{block.items.length} รายการ</p>
                  <ul className={`${s.catalogue} mt-10`}>
                    {block.items.map((item) => (
                      <li key={item} className={`${s.item} ${s.rise}`}>
                        <span aria-hidden className={s.tile} />
                        <span className="headline-wrap pt-1 font-display text-lg font-bold leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </section>

        {rest.length > 0 && (
          <section className="pt-4 pb-10 lg:pt-6 lg:pb-16" aria-labelledby="gallery-head">
            <h2 id="gallery-head" className={`${s.rise} ${s.lead} font-display font-bold text-fg`} style={{ paddingInlineStart: "var(--gutter)" }}>
              ภาพเพิ่มเติม <span className="font-normal text-muted">{rest.length} ภาพ</span>
            </h2>
            <Gallery images={rest} />
          </section>
        )}

        <section id="join" className={s.close} aria-labelledby="join-head">
          <div className={s.closeText}>
            <h2 id="join-head" className={`${s.rise} ${s.lead} headline-wrap font-display font-bold`}>
              {ended ? `สิ้นสุดแล้วเมื่อ ${formatDate(promo.endsAt)}` : `ร่วมรายการได้ถึง ${formatDate(promo.endsAt)}`}
            </h2>
            <p className={`${s.rise} headline-wrap mt-4 max-w-[68ch] text-lg leading-[1.7]`}>{closingText}</p>
            {daysLeft > 0 && <p className={`${s.rise} mt-4 text-lg font-display font-bold`}>เหลืออีก {daysLeft} วัน</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              {links.map((link, n) => (
                // Outbound through /go: the target is counted there and
                // rewritten with UTM tags; rel="sponsored" because it is paid.
                <a
                  key={link.url}
                  href={`/go/${promo.slug}/${n}`}
                  target="_blank"
                  rel="sponsored noopener"
                  className={`${s.button} ${s.buttonInverse} ${s.rise}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          {closing && (
            <Image
              src={closing.url}
              alt={closing.alt}
              width={closing.w}
              height={closing.h}
              loading="lazy"
              sizes="(min-width: 1024px) 66vw, 130vw"
              className={`${s.closeObject} ${s.drift}`}
            />
          )}
        </section>
      </article>
    </div>
  );
}
