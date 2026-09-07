import { cache } from "react";
import type { SourceArticle } from "../types";
import { truncate } from "../normalize";
import { getStoredSourceUrl } from "../store";

/**
 * Facebook reel captions are one headline plus hashtags, so every article page
 * used to be a 37-character placeholder. The Page itself comments on each of
 * its own videos with a link to the story it summarised
 * ("อ่านเพิ่มเติม  https://www.sanook.com/news/9904563"), which is a real,
 * attributable source we can excerpt from.
 *
 * We deliberately do NOT republish the source body. Sanook/ข่าวสด are large
 * commercial publishers; copying their text is infringement, and Google treats
 * a new domain reproducing an established outlet's copy as scraped content,
 * which loses to the original every time. We take the publisher's own
 * og:description (written for syndication) plus at most the first two body
 * paragraphs, hard-capped at MAX_EXCERPT, rendered as an attributed quotation.
 */

/** Hard cap. Never raise this without re-reading the note above. */
const MAX_EXCERPT = 600;
/** At most this many source paragraphs join the publisher's own description. */
const MAX_PARAGRAPHS = 2;
const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE = 3600;

/** The Page prefixes its own source-link comment with this. The other Page
 *  comment on each video is a Shopee affiliate link — same author, different
 *  purpose — so the marker, not the author, is what identifies the source. */
const SOURCE_MARKER = "อ่านเพิ่มเติม";

/** Identifies us honestly to the source hosts, with a way to reach us. */
const USER_AGENT =
  "Mozilla/5.0 (compatible; 1minhotspotBot/1.0; +https://www.1minhotspot.com/)";

/** Query params that are tracking noise, never part of the canonical URL. */
const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|igshid$|mibextid$|ref$|ref_src$|cmpid$|s_kwcid$|__twitter)/i;

/** Hostname → clean Thai/brand display name. A raw hostname is not a byline. */
const PUBLISHERS: ReadonlyArray<[string, string]> = [
  ["sanook.com", "Sanook"],
  ["khaosod.co.th", "ข่าวสด"],
  ["thairath.co.th", "ไทยรัฐ"],
  ["matichon.co.th", "มติชน"],
  ["dailynews.co.th", "เดลินิวส์"],
  ["komchadluek.net", "คมชัดลึก"],
  ["bangkokbiznews.com", "กรุงเทพธุรกิจ"],
  ["thaipbs.or.th", "ไทยพีบีเอส"],
  ["mgronline.com", "ผู้จัดการออนไลน์"],
  ["amarintv.com", "อมรินทร์ทีวี"],
  ["pptvhd36.com", "พีพีทีวี"],
  ["nationtv.tv", "เนชั่นทีวี"],
  ["springnews.co.th", "สปริงนิวส์"],
  ["workpointtoday.com", "Workpoint TODAY"],
  ["ch3plus.com", "ช่อง 3"],
  ["ch7.com", "ช่อง 7"],
  ["one31.net", "ช่อง one31"],
  ["posttoday.com", "โพสต์ทูเดย์"],
  ["prachachat.net", "ประชาชาติธุรกิจ"],
  ["thansettakij.com", "ฐานเศรษฐกิจ"],
  ["naewna.com", "แนวหน้า"],
  ["siamrath.co.th", "สยามรัฐ"],
  ["thaipost.net", "ไทยโพสต์"],
];

/**
 * Share widgets, cookie banners and credit lines that sit inside <p> on the
 * source pages. Sanook's first paragraph is prefixed with
 * "แชร์เรื่องนี้…Copy link ตั้ง Sanook เป็นข่าวโปรดบน Google" before the real lead,
 * so these are cut off the FRONT of a paragraph rather than dropping it.
 */
const LEADING_CRUFT = [
  "Copy link",
  "เป็นข่าวโปรดบน Google",
  "แชร์เรื่องนี้",
];

/** A paragraph containing any of these is navigation/credit, not article text. */
const CRUFT_PARAGRAPH = [
  "คุกกี้",
  "คุ้กกี้",
  "ข่าวที่เกี่ยวข้อง",
  "อ่านข่าวต้นฉบับ",
  "ติดตามข่าวสด",
  "ติดตามข่าว",
  "อัลบั้มภาพ",
  "ขอบคุณภาพ",
  "ขอขอบคุณ",
  "ภาพจาก",
  "เรียบเรียงโดย",
  "advertisement",
  "http://",
  "https://",
];

/** Real Thai body paragraphs are long; anything shorter is a sub-head or caption. */
const MIN_PARAGRAPH = 80;

// --- tiny HTML helpers (no cheerio, no jsdom — we need four fields) ---------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  ndash: "–",
  mdash: "—",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = Number.parseInt(
        body[1] === "x" || body[1] === "X" ? body.slice(2) : body.slice(1),
        body[1] === "x" || body[1] === "X" ? 16 : 10,
      );
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const stripTags = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** First <meta> whose property/name equals `key`, returning its decoded content. */
function meta(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`,
    "i",
  );
  const tag = re.exec(html)?.[0];
  const content = tag ? /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] : undefined;
  return content ? decodeEntities(content).replace(/\s+/g, " ").trim() : "";
}

type LdNode = Record<string, unknown>;

/** Every ld+json node on the page, @graph flattened. Malformed blocks are skipped. */
function jsonLdNodes(html: string): LdNode[] {
  const nodes: LdNode[] = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
        const node = entry as LdNode;
        const graph = node?.["@graph"];
        if (Array.isArray(graph)) nodes.push(...(graph as LdNode[]));
        else if (node) nodes.push(node);
      }
    } catch {
      // A publisher shipping invalid JSON-LD is not our problem to fix.
    }
  }
  return nodes;
}

const ARTICLE_TYPES = new Set(["NewsArticle", "Article", "ReportageNewsArticle", "BlogPosting"]);

function articleNode(nodes: LdNode[]): LdNode | undefined {
  return nodes.find((n) => {
    const t = n["@type"];
    return Array.isArray(t) ? t.some((x) => ARTICLE_TYPES.has(String(x))) : ARTICLE_TYPES.has(String(t));
  });
}

const asString = (v: unknown): string =>
  typeof v === "string" ? decodeEntities(v.replace(/<[^>]*>/g, " ")).replace(/[ \t]+/g, " ").trim() : "";

// --- extraction -------------------------------------------------------------

function publisherName(url: URL, siteName: string): string {
  const host = url.hostname.replace(/^www\./, "");
  const known = PUBLISHERS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  if (known) return known[1];
  // og:site_name is often "www.sanook.com/news" — usable only when it is a real name.
  if (siteName && !/[./]/.test(siteName) && siteName.length <= 40) return siteName;
  return host;
}

function cleanParagraph(text: string): string {
  let t = text;
  for (const marker of LEADING_CRUFT) {
    const at = t.lastIndexOf(marker);
    if (at >= 0) t = t.slice(at + marker.length);
  }
  return t.trim();
}

/** Body paragraphs, cruft filtered. JSON-LD articleBody wins when a publisher ships it. */
function paragraphs(html: string, node: LdNode | undefined): string[] {
  const body = asString(node?.articleBody);
  const raw = body
    ? body.split(/\n+/)
    : [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));

  return raw
    .map(cleanParagraph)
    .filter((p) => p.length >= MIN_PARAGRAPH)
    .filter((p) => !CRUFT_PARAGRAPH.some((c) => p.toLowerCase().includes(c.toLowerCase())));
}

/** First http(s) URL in `text`, tracking params and fragment stripped. Shared
 *  by both source paths so a URL out of the database is normalised exactly
 *  like one scraped from a comment. */
function sanitizeUrl(text: string): URL | null {
  const found = /https?:\/\/[^\s<>"'()]+/.exec(text);
  if (!found) return null;
  let url: URL;
  try {
    url = new URL(found[0]);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url;
}

/** The URL in the Page's own "อ่านเพิ่มเติม" comment, tracking params stripped. */
async function findCommentUrl(videoId: string): Promise<URL | null> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_ACCESS_TOKEN;
  const version = process.env.FB_API_VERSION || "v26.0";
  if (!pageId || !token) return null;

  const endpoint =
    `https://graph.facebook.com/${version}/${encodeURIComponent(videoId)}/comments` +
    `?fields=message,from,created_time&limit=50&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(endpoint, { next: { revalidate: REVALIDATE } });
  const json = (await res.json()) as {
    data?: Array<{ message?: string; from?: { id?: string } }>;
  };

  // Both the source link AND a Shopee affiliate link are posted by the Page,
  // so authorship alone is not enough — require the marker too.
  const comment = (json.data ?? []).find(
    (c) => c.from?.id === pageId && (c.message ?? "").includes(SOURCE_MARKER),
  );
  return sanitizeUrl(comment?.message ?? "");
}

/**
 * The source URL for one reel: the Page's own comment first, then whatever n8n
 * stored at publish time.
 *
 * The comment is preferred because it is what a reader actually sees under the
 * reel, so page and comment can never disagree. The stored URL covers the cases
 * the comment cannot: it was never posted, it was edited, it fell off the end
 * of the 50 comments the edge returns, or FB_ACCESS_TOKEN has expired. n8n knew
 * this URL before the reel existed; there is no reason to drop attribution
 * because a comment went missing.
 */
async function findSourceUrl(videoId: string): Promise<URL | null> {
  const fromComment = await findCommentUrl(videoId);
  if (fromComment) return fromComment;
  const stored = await getStoredSourceUrl(videoId);
  return stored ? sanitizeUrl(stored) : null;
}

async function load(videoId: string): Promise<SourceArticle | null> {
  const url = await findSourceUrl(videoId);
  if (!url) return null;

  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) {
    // Seen live: khaosod.co.th sits behind Cloudflare bot management and
    // answers a Node fetch with 403 "Just a moment..." whatever headers we
    // send (curl gets 200 — it is TLS fingerprinting, not the UA). We do not
    // impersonate a browser to get around a publisher's own access control;
    // the clip keeps its honest placeholder instead.
    console.warn(`[source-article] ${url.hostname} returned ${res.status} — keeping placeholder`);
    return null;
  }
  const html = await res.text();

  const node = articleNode(jsonLdNodes(html));
  const description =
    asString(node?.description) || meta(html, "og:description") || meta(html, "description");

  const parts: string[] = [];
  const push = (text: string) => {
    if (!text) return;
    // Publishers repeat the lead in og:description — don't quote it twice.
    const head = text.slice(0, 40);
    if (parts.some((p) => p.includes(head) || text.includes(p.slice(0, 40)))) return;
    parts.push(text);
  };
  push(description);
  for (const p of paragraphs(html, node).slice(0, MAX_PARAGRAPHS)) push(p);
  if (parts.length === 0) return null;

  const excerpt = truncate(parts.join("\n\n"), MAX_EXCERPT);
  if (!excerpt) return null;

  const imageUrl = meta(html, "og:image") || asString(node?.image);
  const published = asString(node?.datePublished) || meta(html, "article:published_time");

  return {
    url: url.toString(),
    publisher: publisherName(url, meta(html, "og:site_name")),
    excerpt,
    ...(imageUrl.startsWith("https://") ? { imageUrl } : {}),
    ...(published && !Number.isNaN(Date.parse(published))
      ? { publishedAt: new Date(published).toISOString() }
      : {}),
  };
}

// A build renders 50 article pages, each costing a Graph call plus a hit on a
// publisher we do not own. Cap the in-flight fetches so we stay a polite guest.
// ponytail: process-local counter, fine for one build/one server; a shared
// limiter would only matter across processes.
const MAX_CONCURRENT = 5;
let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/**
 * The source article behind one Facebook video, or null. Never throws: a
 * missing comment, an unreachable host, a redesign that breaks parsing — all
 * return null and the caller keeps the honest placeholder. We never fabricate.
 */
export const getSourceArticle = cache(async (videoId: string): Promise<SourceArticle | null> => {
  try {
    return await withSlot(() => load(videoId));
  } catch (err) {
    console.warn(`[source-article] ${videoId}: ${(err as Error).message}`);
    return null;
  }
});

export const SOURCE_EXCERPT_MAX = MAX_EXCERPT;
