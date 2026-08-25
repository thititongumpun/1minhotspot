import type { CategorySlug, Clip } from "./types";
import { toSlug } from "./slug";

/** The one honest stand-in for a body we do not have. Never padded, never faked. */
export const PLACEHOLDER = "รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ";

/** ICU's Thai dictionary, via stdlib. Thai writes no spaces between words, so
 *  this is the only thing that knows where a Thai word actually ends. */
const WORDS = new Intl.Segmenter("th", { granularity: "word" });

/** Thai combining marks (tone/vowel signs) and the four pre-posed vowels,
 *  which are stored BEFORE the consonant they attach to. Cutting on either
 *  side of these shreds a syllable. */
const COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;
const PRE_VOWEL = /[\u0E40-\u0E44]/;

/**
 * Truncate to at most `max` characters *including* the ellipsis, landing on a
 * real word boundary. Latin gets spaces; Thai gets ICU word segmentation.
 * A single unsegmentable run longer than the budget falls back to a hard cut
 * that still backs off a combining mark or pre-posed vowel.
 */
export function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const budget = max - 1; // room for the ellipsis
  let end = 0;
  for (const { index, segment } of WORDS.segment(t)) {
    if (index + segment.length > budget) break;
    end = index + segment.length;
  }
  if (end === 0) {
    end = budget;
    while (end > 0 && (COMBINING.test(t[end]) || PRE_VOWEL.test(t[end - 1]))) end--;
    if (end === 0) end = budget;
  }
  return `${t.slice(0, end).trimEnd()}…`;
}

/** Short keyword lists, first match wins; everything else is viral. */
const KEYWORDS: ReadonlyArray<[CategorySlug, string[]]> = [
  ["politics", ["การเมือง", "รัฐบาล", "รัฐสภา", "เลือกตั้ง", "นายก", "ส.ส.", "politics", "election", "parliament", "cabinet", "minister"]],
  ["economy", ["เศรษฐกิจ", "ราคา", "ค่าเงิน", "หุ้น", "ส่งออก", "ท่องเที่ยว", "ค่าไฟ", "หวย", "สลาก", "ทอง", "economy", "price", "stock", "baht", "export", "inflation"]],
  ["entertainment", ["บันเทิง", "ดารา", "ละคร", "ภาพยนตร์", "หนัง", "นักแสดง", "ไอดอล", "คอนเสิร์ต", "เพลง", "ซีรีส์", "entertainment", "celebrity", "movie", "drama", "concert", "series"]],
  ["society", ["สังคม", "อุบัติเหตุ", "ตำรวจ", "จับกุม", "น้ำท่วม", "โรงเรียน", "โรงพยาบาล", "คุก", "จำคุก", "ศาล", "ยิง", "แทง", "ฆ่า", "ไฟไหม้", "รถชน", "society", "police", "accident", "flood", "school", "hospital"]],
];

export function pickCategory(text: string, tags: string[] = []): CategorySlug {
  const match = (haystack: string) => {
    for (const [slug, words] of KEYWORDS) {
      if (words.some((w) => haystack.includes(w.toLowerCase()))) return slug;
    }
    return undefined;
  };
  // Text is authoritative; tags (creator hashtags, noisy) only break a tie
  // when the article text itself matched nothing.
  return match(text.toLowerCase()) ?? match(tags.join(" ").toLowerCase()) ?? "viral";
}

/**
 * Pulls `#token` occurrences out of raw caption text (real FB reel captions
 * trail a hashtag block, e.g. `... คุก 24 เดือน #เซียนพระ #นครปฐม`). Uses the
 * same `\p{L}\p{N}\p{M}` class as `toSlug` so Thai letters + combining marks
 * (tone/vowel signs) survive intact instead of shredding mid-syllable.
 * Returns the hashtag-free text (whitespace collapsed) and de-duplicated,
 * order-preserving tag values with the `#` stripped. Thai has no case, so a
 * plain `.toLowerCase()` only affects Latin tags and is a safe no-op on Thai.
 * A bare trailing `#` (no token after it) is not a hashtag and is left as-is.
 */
export function extractHashtags(text: string): { text: string; tags: string[] } {
  const seen = new Set<string>();
  const tags: string[] = [];
  const cleaned = text.replace(/#([\p{L}\p{N}\p{M}_]+)/gu, (_match, word: string) => {
    const tag = word.toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
    return "";
  });
  const normalized = cleaned
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: normalized, tags };
}

export type DerivedArticle = {
  title: string;
  summary: string;
  body: string;
  /** hashtags extracted out of title + description, deduplicated. */
  tags: string[];
};

/**
 * Honest derivation from a provider's `title` + `description`.
 *
 * Real Facebook reel captions are typically ONE line, so a provider's
 * `description` alone often has nothing left over for a body once that line
 * becomes the headline — that yields the single labelled placeholder
 * paragraph below. That is a genuine content limitation (there is nothing
 * else to say), not a bug: we refuse to pad or invent filler.
 *
 * What we do fix here: when the provider also hands us a `title` that is
 * genuinely distinct from the description's own first line, we trust it as
 * the real headline and treat the *whole* description as body text, instead
 * of re-deriving a headline from the description and discarding `title`.
 * That's the case where a caption has separate title/body and both should be
 * used — otherwise the body ends up being the title repeated (or nothing).
 * When `title` is empty or just duplicates the description's first line, we
 * fall back to the historical single-line-caption behaviour.
 */
export function deriveArticle(title: string, description: string): DerivedArticle {
  const titleExtract = extractHashtags(title);
  const descExtract = extractHashtags(description);
  const tags = [...titleExtract.tags, ...descExtract.tags].filter((tag, i, arr) => arr.indexOf(tag) === i);

  const trimmedTitle = titleExtract.text.trim();
  const lines = descExtract.text.split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  const firstLine = firstIdx >= 0 ? lines[firstIdx].trim() : "";

  const hasDistinctTitle = trimmedTitle.length > 0 && trimmedTitle !== firstLine;
  // A caption that is nothing but hashtags leaves no prose behind once they're
  // stripped — fall back to the (hashtag-free) tag words themselves rather
  // than emitting an empty title or re-inventing copy.
  const headline = hasDistinctTitle ? trimmedTitle : firstLine || trimmedTitle || tags.join(" ");
  const rest = hasDistinctTitle ? descExtract.text : firstIdx >= 0 ? lines.slice(firstIdx + 1).join("\n") : "";

  const paragraphs = rest
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bodyText = paragraphs.join("\n\n");

  // Under 200 chars of real body gets ONE labelled placeholder paragraph.
  // Never pad, never invent copy.
  const body =
    bodyText.length >= 200 ? bodyText : [bodyText, PLACEHOLDER].filter(Boolean).join("\n\n");

  return {
    title: headline,
    summary: (bodyText || headline).slice(0, 160).trim(),
    body,
    tags,
  };
}

export type RawClip = {
  id: string;
  source: "facebook" | "youtube";
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  durationSec: number;
  thumbnail: { url: string; width: number; height: number };
  embedUrl: string;
  permalink: string;
  tags?: string[];
  views?: number;
};

/** Shared provider → Clip normalizer. Returns null for a clip with no usable
 *  headline (provider gave neither `title` nor `description`) — same
 *  precedent as facebook.ts dropping a clip with no usable thumbnail: an
 *  empty `<h1>`/`<news:title>` is worse than one fewer clip. */
export function buildClip(raw: RawClip): Clip | null {
  const article = deriveArticle(raw.title, raw.description);
  if (!article.title.trim()) return null;
  // Hashtags extracted from the caption become real tags too (and feed
  // pickCategory below), deduplicated against whatever the provider sent.
  const tags = [...(raw.tags ?? []), ...article.tags].filter((tag, i, arr) => arr.indexOf(tag) === i);
  return {
    id: raw.id,
    slug: toSlug(article.title || raw.title || "", raw.id),
    source: raw.source,
    title: article.title,
    summary: article.summary,
    body: article.body,
    category: pickCategory(`${article.title} ${article.body}`, tags),
    publishedAt: raw.publishedAt,
    updatedAt: raw.updatedAt || raw.publishedAt,
    durationSec: raw.durationSec,
    thumbnail: raw.thumbnail,
    embedUrl: raw.embedUrl,
    permalink: raw.permalink,
    tags,
    views: raw.views,
  };
}
