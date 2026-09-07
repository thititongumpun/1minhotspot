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
} from "./seo";
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
  console.log("ok  NewsArticle: real thumbnail is the first image candidate");

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
    sourceArticle: source,
  };
  assert.equal(clipDescription(rewritten), "ย่อหน้าแรกจากสคริปต์");
  assert.equal(clipDescription({ ...rewritten, hasScript: false }), source.excerpt);
  console.log("ok  clipDescription: rewrite outranks excerpt, excerpt still wins without one");

  // transcript is a claim about the video's spoken audio. Only the n8n rewrite
  // is that script; an excerpt or the placeholder is someone else's text.
  assert.equal(videoObjectJsonLd(rewritten).transcript, rewritten.body);
  assert.ok(!("transcript" in videoObjectJsonLd({ ...rewritten, hasScript: false })));
  console.log("ok  VideoObject: transcript only when the body is the spoken script");
}

main();
