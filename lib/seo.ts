import { isoDuration } from "@/components/format";
import { truncate } from "./normalize";
import { categoryLabel, type Clip } from "./types";

/** The publisher name. */
const SITE_NAME = "สรุปข่าวร้อนใน 1 นาที";

/** BCP-47 tag for `inLanguage`. The site is Thai-only. */
const LANG = "th-TH";

/** Google truncates NewsArticle headlines past this; longer ones are dropped outright. */
const MAX_HEADLINE = 110;

/**
 * The single source of truth for the public origin — never with a trailing slash.
 * Nothing else in the app may read NEXT_PUBLIC_SITE_URL: a second reader with a
 * different default is how one build ends up emitting two different origins.
 */
const FALLBACK_ORIGIN = "https://www.1minhotspot.site";

export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_ORIGIN).trim();
  // A bare host ("1minhotspot.site") is the usual .env slip. Left alone it
  // reaches `new URL()` in layout.tsx's metadataBase, which throws at module
  // evaluation — one missing scheme 500s every route on the site.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (!URL.canParse(withScheme)) {
    console.error(`[seo] NEXT_PUBLIC_SITE_URL is not a URL: "${raw}" — using ${FALLBACK_ORIGIN}`);
    return FALLBACK_ORIGIN;
  }
  return withScheme.replace(/\/+$/, "");
}

/**
 * Absolute URL with every path segment percent-encoded. Slugs carry Thai
 * codepoints, and a `<loc>`/`<link rel=canonical>` carrying raw UTF-8 bytes is
 * not a valid URI — encoding here, once, means no call site can forget to.
 * Callers pass raw (never pre-encoded) paths.
 */
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  // Root special case: `"/".split("/")` is `["", ""]`, which re-joins to "/"
  // and would emit `siteUrl() + "/"` — the one path that disagrees with
  // Next's own canonical resolution, which strips the trailing slash on "/".
  // Keeping this bare (no trailing slash) makes every home-page URL we emit
  // (canonical, WebSite.url, sitemap <loc>) byte-identical.
  return encoded === "/" ? siteUrl() : `${siteUrl()}${encoded}`;
}

/** Google shows roughly this much of a meta description. */
const MAX_DESCRIPTION = 160;

/**
 * The description Google and the social cards see. Preference order is whatever
 * the page actually shows as its body: the n8n rewrite first, then the Page's
 * own attributed source excerpt, then the derived summary. Either of the first
 * two beats a summary derived from a one-line reel caption (which is usually
 * just the headline again).
 *
 * When there is no excerpt, `deriveArticle` falls back `summary -> headline`
 * (a thin one-line caption has no body left to summarise). A description
 * that's just the title again is worse than none: Google flags duplicate
 * title/description pairs, and a social card gains nothing repeating the
 * headline as its own subtitle. Omit it in that case rather than duplicate.
 */
export function clipDescription(clip: Clip): string | undefined {
  // A rewrite outranks the excerpt: with one present the article page stops
  // rendering the quotation, and a description promising text the visitor
  // cannot find on the page is exactly the mismatch Google penalises.
  const lead = clip.hasScript ? clip.body.split("\n\n")[0]?.trim() : "";
  if (lead) return truncate(lead.replace(/\s+/g, " "), MAX_DESCRIPTION);

  const excerpt = clip.sourceArticle?.excerpt;
  if (excerpt) return truncate(excerpt.replace(/\s+/g, " "), MAX_DESCRIPTION);
  if (clip.summary.trim() === clip.title.trim()) return undefined;
  return truncate(clip.summary, MAX_DESCRIPTION);
}

/** Social profiles, kept in sync with components/site-footer.tsx. */
const SAME_AS = [
  "https://www.facebook.com/1minhotspot",
  "https://www.youtube.com/@1minhotspot",
];

const organization = () => ({
  "@type": "Organization" as const,
  name: SITE_NAME,
  url: siteUrl(),
  // The generated home OG image doubles as the publisher logo — Google wants a
  // logo on publisher for Top Stories, and this is the only brand image we own.
  logo: {
    "@type": "ImageObject" as const,
    url: absoluteUrl("/opengraph-image"),
    width: 1200,
    height: 630,
  },
  sameAs: SAME_AS,
});

export function newsArticleJsonLd(clip: Clip) {
  const url = absoluteUrl(`/news/${clip.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: truncate(clip.title, MAX_HEADLINE),
    description: clipDescription(clip),
    datePublished: clip.publishedAt,
    dateModified: clip.updatedAt,
    // The generated 1200x630 16:9 card (this route's opengraph-image.tsx)
    // first — that's the ratio Google's NewsArticle image guidelines and
    // Google Images actually want. The portrait reel still follows as a
    // second candidate; more image candidates never hurts, a portrait-only
    // array does.
    image: [`${url}/opengraph-image`, clip.thumbnail.url],
    inLanguage: LANG,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: organization(),
    publisher: organization(),
    articleSection: categoryLabel(clip.category),
    // The excerpt on the page is quoted from the source, not our reporting.
    // isBasedOn names the work we summarised; citation points at the same URL
    // so a crawler reading either property finds the original.
    ...(clip.sourceArticle
      ? {
          isBasedOn: {
            "@type": "NewsArticle",
            url: clip.sourceArticle.url,
            ...(clip.sourceArticle.publishedAt ? { datePublished: clip.sourceArticle.publishedAt } : {}),
            publisher: { "@type": "Organization", name: clip.sourceArticle.publisher },
          },
          citation: clip.sourceArticle.url,
        }
      : {}),
  };
}

export function videoObjectJsonLd(clip: Clip) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: clip.title,
    description: clipDescription(clip),
    thumbnailUrl: [clip.thumbnail.url],
    uploadDate: clip.publishedAt,
    duration: isoDuration(clip.durationSec),
    embedUrl: clip.embedUrl,
    inLanguage: LANG,
    // The body IS the script the TTS speaks in the reel, so page and video
    // saying the same thing is a transcript relationship, not an unexplained
    // duplicate. Gated on hasScript: a publisher excerpt or the placeholder is
    // not a transcript and must never be labelled one.
    ...(clip.hasScript ? { transcript: clip.body } : {}),
    // contentUrl only when the source hands us a direct media file. Facebook and
    // YouTube give a watch page, not a file, so the field is omitted rather than faked.
  };
}

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: LANG,
    publisher: organization(),
  };
}

export function organizationJsonLd() {
  return { "@context": "https://schema.org", ...organization() };
}
