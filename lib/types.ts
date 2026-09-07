export type CategorySlug = "society" | "entertainment" | "politics" | "viral" | "economy";

/**
 * An attributed excerpt from the story the clip summarises, found via the
 * Page's own "อ่านเพิ่มเติม" comment. `excerpt` is quoted material owned by
 * `publisher` — it is never the site's own reporting and must always be
 * rendered as a marked quotation next to a visible link to `url`.
 */
export type SourceArticle = {
  url: string;
  publisher: string; // clean display name, e.g. "Sanook", "ข่าวสด"
  excerpt: string; // <= 600 chars, quoted with attribution — never republished in full
  imageUrl?: string;
  publishedAt?: string; // ISO 8601
};

export type Clip = {
  id: string;
  slug: string; // url-safe, stable, derived from id + transliterated title
  source: "facebook" | "youtube" | "sample";
  title: string;
  summary: string; // 1-2 sentences, used for meta description
  body: string; // article text, paragraphs joined by "\n\n"
  category: CategorySlug;
  publishedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  durationSec: number;
  thumbnail: { url: string; width: number; height: number };
  embedUrl: string; // iframe src (FB video plugin or YT embed)
  permalink: string; // canonical source URL
  tags: string[];
  /** Present only on the single-clip path; list pages never fetch it. */
  sourceArticle?: SourceArticle;
  /**
   * True when `body` is the n8n Thai rewrite rather than a provider caption.
   * The store coalesces both into `body`, so without this flag nothing
   * downstream can tell our own narration from a derived one — and the
   * article page needs to know, because it only quotes the source excerpt
   * when we have nothing of our own to say.
   */
  hasScript?: boolean;
  /** The spoken narration when the page body is the longer written article. */
  transcript?: string;
  /**
   * Facebook reel view count from the /videos edge. Optional because YouTube
   * and sample sources don't have one, and a clip that has aged out of the
   * 50-item /videos window (see facebook.ts) keeps whatever count was last
   * seen rather than getting refreshed — undefined, not 0, is what "we never
   * had a real number" looks like.
   */
  views?: number;
};

/** Display order for category strips and nav. */
export const CATEGORIES: ReadonlyArray<{ slug: CategorySlug; label: string }> = [
  { slug: "society", label: "ข่าวสังคม" },
  { slug: "entertainment", label: "บันเทิง" },
  { slug: "politics", label: "การเมือง" },
  { slug: "viral", label: "ไวรัล" },
  { slug: "economy", label: "เศรษฐกิจ" },
];

/** The single place a category slug turns into display text. */
export const categoryLabel = (slug: CategorySlug): string =>
  CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
