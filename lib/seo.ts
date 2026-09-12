import type { Metadata } from "next";
import { isoDuration } from "@/components/format";
import { countWords, PLACEHOLDER, truncate, truncateSentence } from "./normalize";
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
const FALLBACK_ORIGIN = "https://www.1minhotspot.com";

export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_ORIGIN).trim();
  // A bare host ("1minhotspot.com") is the usual .env slip. Left alone it
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
/**
 * Open Graph for a plain page. og:title/og:description are inherited from the
 * page's own title/description by Next, so only what it cannot infer is set —
 * and it must be set on every page, because a page's `openGraph` replaces the
 * layout's wholesale. Facebook's debugger flags any page missing og:url/og:type.
 */
export function pageOpenGraph(url: string): NonNullable<Metadata["openGraph"]> {
  return { type: "website", url, siteName: SITE_NAME, locale: "th_TH" };
}

export const MAX_DESCRIPTION = 160;

export const SITE_DESCRIPTION =
  "รวมคลิปข่าวสั้นรอบวัน อัปเดตไว จบในนาทีเดียว ทันทุกกระแสสังคม บันเทิง การเมือง เศรษฐกิจ และไวรัล ข่าววันนี้";

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
  if (lead) return truncateSentence(lead, MAX_DESCRIPTION);

  const excerpt = clip.sourceArticle?.excerpt;
  if (excerpt) return truncateSentence(excerpt, MAX_DESCRIPTION);
  if (clip.summary.trim() === clip.title.trim()) return undefined;
  return truncateSentence(clip.summary, MAX_DESCRIPTION);
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
  // Google wants a SQUARE publisher logo for Top Stories; the 1200x630 OG card
  // was being cropped. public/logo.png is a real 512x512 (verified with `file`)
  // on a stable, unhashed URL — the same file layout.tsx points `icons.icon` at.
  logo: {
    "@type": "ImageObject" as const,
    url: absoluteUrl("/logo.png"),
    width: 512,
    height: 512,
  },
  sameAs: SAME_AS,
});

/**
 * The article text as the page actually renders it: PLACEHOLDER paragraphs
 * stripped. "รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ" is an honest stand-in for a
 * body we do not have — it is not article prose, and shipping it as
 * `articleBody` would claim 6 words of content that say nothing. When nothing
 * is left, both fields are omitted rather than emitted empty.
 */
function articleBodyOf(clip: Clip): string {
  return clip.body
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== PLACEHOLDER)
    .join("\n\n");
}

/** For hand-built XML (news sitemap, RSS): the five characters XML 1.0 reserves. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function newsArticleJsonLd(clip: Clip) {
  const url = absoluteUrl(`/news/${clip.slug}`);
  const body = articleBodyOf(clip);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: truncate(clip.title, MAX_HEADLINE),
    description: clipDescription(clip),
    datePublished: clip.publishedAt,
    dateModified: clip.updatedAt,
    // The real reel still first — it is served from our own domain, does not
    // expire, and is the one distinctive frame Discover can rank on. The
    // generated OG card second: Google wants both a portrait and a landscape
    // image candidate, and the 1200x630 card is the landscape one.
    image: [clip.thumbnail.url, `${url}/opengraph-image`],
    inLanguage: LANG,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: organization(),
    publisher: organization(),
    articleSection: categoryLabel(clip.category),
    ...(body ? { articleBody: body, wordCount: countWords(body) } : {}),
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
    // The narration the TTS speaks in the reel. With no written article it is
    // also the page body, so page and video saying the same thing is a
    // transcript relationship, not an unexplained duplicate. Only ever the
    // script: a publisher excerpt or the placeholder is not a transcript and
    // must never be labelled one.
    ...(clip.transcript ? { transcript: clip.transcript } : {}),
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

/** ItemList entries past this add bytes without adding meaning; the page's own
 *  grid is the full list and every entry is already a crawlable <a href>. */
const MAX_ITEM_LIST = 20;

/**
 * A listing page as a CollectionPage whose mainEntity is the ordered ItemList
 * of its articles. ListItem carries `url` + `name` only — no nested Article
 * node, which would restate metadata the article page already owns and can
 * drift from it.
 */
export function collectionPageJsonLd(args: {
  name: string;
  description: string;
  path: string;
  clips: ReadonlyArray<Pick<Clip, "slug" | "title">>;
}) {
  const url = absoluteUrl(args.path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: args.name,
    description: args.description,
    url,
    inLanguage: LANG,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
    publisher: organization(),
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: args.clips.length,
      itemListElement: args.clips.slice(0, MAX_ITEM_LIST).map((clip, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(`/news/${clip.slug}`),
        name: clip.title,
      })),
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: LANG,
    publisher: organization(),
  };
}

export function organizationJsonLd() {
  return { "@context": "https://schema.org", ...organization() };
}
