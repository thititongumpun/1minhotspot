// Self-check, no framework: `rtk pnpm exec tsx lib/seo.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";
import {
  absoluteUrl,
  MAX_DESCRIPTION,
  newsArticleJsonLd,
  organizationJsonLd,
  siteUrl,
  videoObjectJsonLd,
  websiteJsonLd,
  clipDescription,
  collectionPageJsonLd,
} from "./seo";
import { PLACEHOLDER } from "./normalize";
import { sampleClips } from "./sample-clips";

const clip = sampleClips[0];

function main() {
  assert.equal(siteUrl().endsWith("/"), false);
  console.log("ok  siteUrl has no trailing slash");

  // Single origin: one build must never emit two hosts. seo.ts is the only reader
  // of NEXT_PUBLIC_SITE_URL, and its default is the real domain, never localhost.
  const savedEnv = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(siteUrl(), "https://www.1minhotspot.com");
  // A bare host is the usual .env slip; unguarded it throws in metadataBase.
  process.env.NEXT_PUBLIC_SITE_URL = "1minhotspot.com";
  assert.equal(siteUrl(), "https://1minhotspot.com");
  process.env.NEXT_PUBLIC_SITE_URL = "not a url at all";
  assert.equal(siteUrl(), "https://www.1minhotspot.com");
  process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com/";
  const origin = siteUrl();
  assert.equal(origin, "https://staging.example.com");
  for (const url of [
    absoluteUrl("/"),
    absoluteUrl(`/news/${clip.slug}`),
    newsArticleJsonLd(clip).mainEntityOfPage["@id"],
    websiteJsonLd().url,
    organizationJsonLd().url,
    organizationJsonLd().logo.url,
  ]) {
    assert.ok(url === origin || url.startsWith(`${origin}/`), `${url} is not on ${origin}`);
  }
  if (savedEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = savedEnv;
  console.log("ok  single origin: every emitted URL comes from siteUrl()");

  // No locale prefixes survive anywhere: the site is Thai-only and unprefixed.
  for (const url of [
    absoluteUrl("/"),
    absoluteUrl("/videos"),
    absoluteUrl(`/news/${clip.slug}`),
    websiteJsonLd().url,
    organizationJsonLd().logo.url,
  ]) {
    assert.ok(!/\/(th|en)(\/|$)/.test(new URL(url).pathname), `${url} still carries a locale prefix`);
  }
  console.log("ok  no /th or /en path segments in emitted URLs");

  // Thai slugs must never leave the app as raw UTF-8 bytes in a URL.
  const thai = { ...clip, slug: "ตำรวจจับกุม-abc123" };
  const thaiUrl = absoluteUrl(`/news/${thai.slug}`);
  assert.ok(!/[฀-๿]/.test(thaiUrl), `raw Thai bytes in ${thaiUrl}`);
  assert.equal(decodeURIComponent(new URL(thaiUrl).pathname), `/news/${thai.slug}`);
  assert.equal(newsArticleJsonLd(thai).mainEntityOfPage["@id"], thaiUrl);
  console.log("ok  absoluteUrl percent-encodes Thai path segments, round-trips");

  // Thai-only site: inLanguage is a constant, and it is never en-US.
  assert.equal(newsArticleJsonLd(clip).inLanguage, "th-TH");
  assert.equal(videoObjectJsonLd(clip).inLanguage, "th-TH");
  assert.equal(websiteJsonLd().inLanguage, "th-TH");
  console.log("ok  inLanguage: always th-TH");

  // WebSite needs a description for it to be worth anything to a crawler.
  const websiteDescription = websiteJsonLd().description;
  assert.ok(websiteDescription.length > 0, "websiteJsonLd().description is empty");
  assert.ok(
    websiteDescription.length < MAX_DESCRIPTION,
    `websiteJsonLd().description is ${websiteDescription.length} chars, over the ${MAX_DESCRIPTION} budget`,
  );
  console.log("ok  websiteJsonLd: description is non-empty and under budget");

  // The 110-char cap is the whole point: Google drops longer headlines.
  const longLatin = { ...clip, title: `${"word ".repeat(40)}end` };
  const latin = newsArticleJsonLd(longLatin).headline;
  assert.ok(latin.length <= 110, `latin headline ${latin.length} > 110`);
  assert.ok(latin.endsWith("…") && !latin.endsWith(" …"));

  const longThai = { ...clip, title: "ก".repeat(300) };
  const thaiHeadline = newsArticleJsonLd(longThai).headline;
  assert.ok(thaiHeadline.length <= 110, `thai headline ${thaiHeadline.length} > 110`);

  assert.equal(newsArticleJsonLd(clip).headline, clip.title);
  console.log("ok  headline clamp: <=110 chars, short titles untouched");

  // Discover ranks on the first image: the real, own-domain still, never the
  // generated card that looks identical on every article.
  assert.equal(newsArticleJsonLd(clip).image[0], clip.thumbnail.url);
  // Second candidate is the generated 1200x630 OG card — Google wants both a
  // portrait (the reel still) and a landscape image candidate.
  assert.equal(newsArticleJsonLd(clip).image[1], `${absoluteUrl(`/news/${clip.slug}`)}/opengraph-image`);
  console.log("ok  NewsArticle: real thumbnail first, generated OG card second");

  assert.equal(videoObjectJsonLd(clip).duration, "PT47S");
  assert.equal("contentUrl" in videoObjectJsonLd(clip), false);
  console.log("ok  VideoObject: real duration, no invented contentUrl");

  // The article page hides the source quotation once a rewrite exists, so the
  // description must follow the body and stop advertising the excerpt.
  const source = { url: "https://example.com/a", publisher: "Sanook", excerpt: "ข้อความต้นฉบับ" };
  const rewritten = {
    ...clip,
    hasScript: true,
    body: "ย่อหน้าแรกจากสคริปต์\n\nย่อหน้าที่สอง",
    transcript: "ย่อหน้าแรกจากสคริปต์\n\nย่อหน้าที่สอง",
    sourceArticle: source,
  };
  assert.equal(clipDescription(rewritten), "ย่อหน้าแรกจากสคริปต์");
  assert.equal(clipDescription({ ...rewritten, hasScript: false }), source.excerpt);
  console.log("ok  clipDescription: rewrite outranks excerpt, excerpt still wins without one");

  // transcript is a claim about the video's spoken audio. Only the n8n rewrite
  // is that script; an excerpt or the placeholder is someone else's text.
  assert.equal(videoObjectJsonLd(rewritten).transcript, rewritten.transcript);
  assert.ok(!("transcript" in videoObjectJsonLd({ ...rewritten, transcript: undefined })));
  // With a written article the body moves on but the transcript stays the
  // narration — never the article, which nobody speaks in the reel.
  const withArticle = { ...rewritten, body: "บทความยาว\n\nย่อหน้าสอง\n\nย่อหน้าสาม" };
  assert.equal(videoObjectJsonLd(withArticle).transcript, rewritten.transcript);
  assert.equal(clipDescription(withArticle), "บทความยาว");
  console.log("ok  VideoObject: transcript is always the narration, never the article");

  const collection = collectionPageJsonLd({ name: "การเมือง", description: "x", path: "/category/politics", clips: sampleClips });
  assert.equal(collection.mainEntity.itemListElement.length, Math.min(sampleClips.length, 20));
  assert.equal(collection.mainEntity.itemListElement[0].position, 1);
  assert.ok(collection.mainEntity.itemListElement[0].url.startsWith(siteUrl() + "/news/"));
  assert.equal(collection.url, absoluteUrl("/category/politics"));
  console.log("ok  collectionPageJsonLd: ItemList capped, 1-based, absolute URLs");

  const long = { ...clip, hasScript: true, body: `${"ประโยคแรกยาวพอสมควรจริง ๆ ".repeat(4)}จบประโยค อีกประโยคหนึ่งที่ยาวเกินงบประมาณไปมากจนต้องตัดทิ้งแน่นอน` };
  const d = clipDescription(long)!;
  assert.ok(d.length <= MAX_DESCRIPTION, `${d.length} > ${MAX_DESCRIPTION}`);
  assert.equal(d.endsWith("…"), false, "a sentence-boundary cut must not add an ellipsis");
  // One unbroken run has no boundary — must fall back to the ellipsis cut.
  const runOn = { ...clip, hasScript: true, body: "ก".repeat(400) };
  assert.ok(clipDescription(runOn)!.endsWith("…"));
  console.log("ok  clipDescription: sentence boundary without ellipsis, ellipsis fallback on a run-on");

  const bodied = { ...clip, hasScript: true, body: "ตำรวจจับกุมผู้ต้องหา\n\nรายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ" };
  const ld = newsArticleJsonLd(bodied);
  assert.equal(ld.articleBody, "ตำรวจจับกุมผู้ต้องหา", "the placeholder must never reach articleBody");
  // `wordCount` is typed optional (it is omitted, not zero, when there's no body) —
  // the `!`s are the runtime guarantee this fixture has a body, not a type escape hatch.
  assert.ok(ld.wordCount! >= 3 && ld.wordCount! < 10, `wordCount ${ld.wordCount} is not a Thai word count`);
  const empty = newsArticleJsonLd({ ...clip, body: PLACEHOLDER });
  assert.ok(!("articleBody" in empty) && !("wordCount" in empty), "no body -> neither field");
  console.log("ok  NewsArticle: articleBody strips the placeholder, wordCount is ICU words");
}

main();
