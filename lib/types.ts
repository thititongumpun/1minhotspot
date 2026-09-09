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
  /** Same "undefined means never counted" contract as views. Article page only. */
  likes?: number;
  comments?: number;
};

/** Display order for category strips and nav.
 *  `intro` is the 2-3 sentence Thai lede /category/<slug> renders above the grid
 *  — before it, a category page had zero words outside the cards, which is what
 *  the audit flagged as thin content. Keep it 2-3 real sentences: never padded,
 *  never a keyword list. */
export const CATEGORIES: ReadonlyArray<{ slug: CategorySlug; label: string; intro: string }> = [
  {
    slug: "society",
    label: "ข่าวสังคม",
    intro:
      "รวมข่าวสังคมไทยรอบวันในรูปแบบคลิปสั้น ทั้งอุบัติเหตุ คดีความ ภัยพิบัติ และเรื่องราวในชุมชนที่คนพูดถึงมากที่สุด ทุกคลิปสรุปใจความสำคัญให้จบภายในหนึ่งนาที และมีลิงก์ไปยังสำนักข่าวต้นฉบับเมื่อระบุแหล่งที่มาได้",
  },
  {
    slug: "entertainment",
    label: "บันเทิง",
    intro:
      "รวมข่าวบันเทิงไทยและต่างประเทศแบบคลิปสั้น ทั้งความเคลื่อนไหวของดารา นักแสดง ศิลปิน ละคร ซีรีส์ และคอนเสิร์ต เราเลือกเฉพาะเรื่องที่เป็นกระแสจริงในแต่ละวัน แล้วสรุปให้ฟังจบในหนึ่งนาที",
  },
  {
    slug: "politics",
    label: "การเมือง",
    intro:
      "รวมข่าวการเมืองไทยรอบวันในรูปแบบคลิปสั้น ทั้งความเคลื่อนไหวในรัฐสภา นโยบายรัฐบาล การเลือกตั้ง และท่าทีของพรรคการเมือง เราสรุปเฉพาะสาระสำคัญโดยไม่เข้าข้างฝ่ายใด ให้ตามทันสถานการณ์ได้ในหนึ่งนาที",
  },
  {
    slug: "viral",
    label: "ไวรัล",
    intro:
      "รวมเรื่องไวรัลและกระแสโซเชียลที่คนไทยพูดถึงมากที่สุดในแต่ละวัน ทั้งคลิปดัง ดราม่าออนไลน์ และเรื่องราวแปลกที่กลายเป็นที่สนใจ เราสรุปที่มาที่ไปให้ครบในหนึ่งนาที เพื่อให้เข้าใจเรื่องทั้งหมดโดยไม่ต้องไล่อ่านโพสต์ยาว",
  },
  {
    slug: "economy",
    label: "เศรษฐกิจ",
    intro:
      "รวมข่าวเศรษฐกิจที่กระทบชีวิตประจำวันแบบคลิปสั้น ทั้งราคาสินค้า ค่าไฟ ค่าเงินบาท หุ้น ทองคำ และมาตรการของรัฐ เราอธิบายให้เข้าใจง่ายโดยไม่ต้องมีพื้นฐานการเงิน จบในหนึ่งนาที",
  },
];

/** The single place a category slug turns into display text. */
export const categoryLabel = (slug: CategorySlug): string =>
  CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
