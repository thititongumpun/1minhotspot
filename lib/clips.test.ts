// Self-check, no framework: `rtk pnpm exec tsx lib/clips.test.ts`. Exits 0 when green.
import assert from "node:assert/strict";
// Pinned before any Bangkok-boundary math runs below: bangkokYearMonth (in
// clips.ts) always passes an explicit timeZone, so this should be a no-op —
// pinning proves that, the same way components/format.test.ts pins TZ to
// keep formatDate's own timeZone option honest.
process.env.TZ = "UTC";
import { getClips, getMostViewedThisMonth, pickMostViewedThisMonth } from "./clips";
import type { Clip } from "./types";
import { toSlug } from "./slug";
import { PLACEHOLDER, buildClip, deriveArticle, extractHashtags, pickCategory, truncate } from "./normalize";
import { toIso } from "./providers/facebook";
import { SOURCE_EXCERPT_MAX, getSourceArticle } from "./providers/source-article";
import { parseIsoDuration } from "./providers/youtube";

async function main() {
  for (const key of ["FB_PAGE_ID", "FB_ACCESS_TOKEN", "YT_API_KEY", "YT_CHANNEL_ID"]) {
    delete process.env[key];
  }

  const clips = await getClips();
  assert.equal(clips.length, 12, "expected 12 sample clips");
  assert.ok(clips.every((c) => c.source === "sample"));
  const times = clips.map((c) => Date.parse(c.publishedAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "clips must be newest first");
  console.log("ok  getClips(): 12 sample clips, newest first");

  for (const c of clips) {
    const where = `clip ${c.id}`;
    for (const f of ["id", "slug", "source", "category", "embedUrl", "permalink"] as const) {
      assert.ok(typeof c[f] === "string" && c[f].length > 0, `${where}: missing ${f}`);
    }
    assert.ok(c.durationSec > 0, `${where}: durationSec`);
    assert.ok(!Number.isNaN(Date.parse(c.publishedAt)) && !Number.isNaN(Date.parse(c.updatedAt)), where);
    assert.ok(c.thumbnail.url.startsWith("https://") && c.thumbnail.width > 0 && c.thumbnail.height > 0, where);
    assert.ok(c.title.length > 0, `${where}: title`);
    assert.ok(c.summary.length > 0, `${where}: summary`);
    assert.ok(c.body.length > 200, `${where}: body`);
  }
  console.log("ok  shape: required fields, duration > 0, title/summary/body non-empty");

  const slugs = clips.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slugs must be unique");
  assert.ok(slugs.every((s) => /^[a-z0-9-]+$/.test(s)), "slugs must be ascii-safe");
  console.log("ok  slugs: unique and ascii-safe");

  assert.equal(parseIsoDuration("PT47S"), 47);
  assert.equal(parseIsoDuration("PT1M3S"), 63);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  console.log("ok  parseIsoDuration: PT47S / PT1M3S / PT1H2M3S");

  // F1: a pure-Thai title must keep Thai keywords in the slug (Google indexes
  // percent-encoded Thai URLs normally) instead of collapsing to a bare id.
  const thaiTitle = "ตำรวจจับกุมแก๊งคอลเซ็นเตอร์กลางกรุง";
  const thaiSlug = toSlug(thaiTitle, "1234567890123456");
  assert.ok(/[฀-๿]/.test(thaiSlug), `expected Thai codepoints in slug, got ${thaiSlug}`);
  assert.match(thaiSlug, /-[a-z0-9]{4,8}$/, `expected stable ascii id tail, got ${thaiSlug}`);
  const roundTripped = decodeURIComponent(encodeURIComponent(thaiSlug));
  assert.equal(roundTripped, thaiSlug, "slug must round-trip through encodeURIComponent/decodeURIComponent");
  console.log(`ok  toSlug: pure-Thai title keeps Thai keywords (${thaiSlug}), round-trips through URL encoding`);

  // F1: stable across repeated calls, unique across different ids.
  const slugA1 = toSlug(thaiTitle, "aaa111");
  const slugA2 = toSlug(thaiTitle, "aaa111");
  assert.equal(slugA1, slugA2, "toSlug must be stable across calls for the same input");
  const slugB = toSlug(thaiTitle, "bbb222");
  assert.notEqual(slugA1, slugB, "different ids must produce different (unique) slugs");
  console.log("ok  toSlug: stable across repeated calls, unique across different ids");

  // F2: a genuinely distinct title + description must both be used — the
  // title becomes the headline and the (different) description becomes the
  // body, not a repeat of the title and not just the boilerplate placeholder.
  const distinctTitle = "ตำรวจจับกุมแก๊งคอลเซ็นเตอร์กลางกรุง";
  const distinctDescription =
    "เจ้าหน้าที่ตำรวจสามารถจับกุมเครือข่ายแก๊งคอลเซ็นเตอร์ได้กลางกรุงเทพมหานครเมื่อคืนที่ผ่านมา " +
    "ภายหลังการเฝ้าติดตามพฤติกรรมต่อเนื่องหลายสัปดาห์ โดยผู้ต้องหาให้การรับสารภาพในชั้นสอบสวนเบื้องต้น";
  const distinct = deriveArticle(distinctTitle, distinctDescription);
  assert.equal(distinct.title, distinctTitle, "distinct title must be used as the headline verbatim");
  assert.ok(
    distinct.body.includes("เจ้าหน้าที่ตำรวจสามารถจับกุม"),
    "body must carry the description text, not just the title",
  );
  assert.ok(!distinct.body.startsWith(distinctTitle), "body must not just repeat the title");
  console.log("ok  deriveArticle: distinct title + description both used; body is not a title repeat");

  // A single-line caption with no distinct title is the genuine one-line
  // case: the honest placeholder must still be the whole body, not fabricated.
  const oneLiner = deriveArticle("", "ด่วน! น้ำท่วมเชียงใหม่");
  assert.ok(
    oneLiner.body.includes("รายละเอียดเพิ่มเติมอยู่ระหว่างตรวจสอบ"),
    "thin one-line caption must still fall back to the honest placeholder",
  );
  console.log("ok  deriveArticle: one-line caption keeps the honest placeholder behaviour");

  // Real FB reel caption shape: headline + trailing hashtag block. Hashtags
  // must be routed into tags, not left in the title/slug (the reported bug).
  const hashtagCaption =
    "เซียนพระ นครปฐม คุก 24 เดือน #เซียนพระ #ข่าวอาชญากรรม #คดีดัง #นครปฐม #กฎหมาย";
  const withHashtags = deriveArticle("", hashtagCaption);
  assert.equal(withHashtags.title, "เซียนพระ นครปฐม คุก 24 เดือน", "hashtag block must be stripped from the headline");
  assert.ok(!withHashtags.title.includes("#"), "title must never contain a raw hashtag");
  assert.deepEqual(
    withHashtags.tags,
    ["เซียนพระ", "ข่าวอาชญากรรม", "คดีดัง", "นครปฐม", "กฎหมาย"],
    "hashtags must be extracted into tags, order-preserving",
  );
  console.log("ok  deriveArticle: trailing hashtag block stripped from headline and routed into tags");

  // Only-hashtags caption: title must not become empty.
  const onlyHashtags = deriveArticle("", "#a #b #a #c");
  assert.ok(onlyHashtags.title.length > 0, "only-hashtags caption must not produce an empty title");
  assert.ok(!onlyHashtags.title.includes("#"), "fallback title must not contain a raw hashtag");
  assert.deepEqual(onlyHashtags.tags, ["a", "b", "c"], "duplicate hashtags must be de-duplicated, order-preserving");
  console.log("ok  deriveArticle: only-hashtags caption falls back to a non-empty title, tags de-duplicated");

  // extractHashtags edge cases directly: no hashtags, mid-sentence hashtag,
  // and a bare trailing "#" (no token after it) which is not a hashtag.
  assert.deepEqual(extractHashtags("plain text, no hashtags"), { text: "plain text, no hashtags", tags: [] });
  assert.deepEqual(extractHashtags("ก่อน #กลาง หลัง"), { text: "ก่อน หลัง", tags: ["กลาง"] });
  assert.deepEqual(extractHashtags("caption text #"), { text: "caption text #", tags: [] }, "bare # is not a hashtag");
  assert.deepEqual(extractHashtags("#Foo #foo #BAR"), { text: "", tags: ["foo", "bar"] }, "Latin tags lowercased + deduped");
  console.log("ok  extractHashtags: no-hashtag, mid-sentence, bare-#, and Latin lowercase+dedupe edge cases");

  // Text must be authoritative over tags: a stabbing/police headline tagged
  // with an unrelated entertainment hashtag must still resolve to society.
  assert.equal(
    pickCategory("งานวันเกิดเดือด! แทงตำรวจบาดเจ็บ", ["บันเทิง"]),
    "society",
    "article text must win over a noisy entertainment tag",
  );
  // Tags remain a fallback when the text itself matches nothing.
  assert.equal(
    pickCategory("เรื่องทั่วไปที่ไม่มีคีย์เวิร์ด", ["บันเทิง"]),
    "entertainment",
    "tag must still decide the category when text matches nothing",
  );
  console.log("ok  pickCategory: text beats tags, tags remain a fallback when text matches nothing");

  // A clip with neither a usable title nor description (a bare hashtag/emoji
  // caption, or a provider that just gave nothing) must be dropped rather
  // than ship an empty <h1>/<news:title> — same precedent as facebook.ts
  // dropping a clip with no usable thumbnail.
  const rawBase = {
    id: "empty-1",
    source: "facebook" as const,
    publishedAt: "2026-08-21T00:00:00.000Z",
    durationSec: 30,
    thumbnail: { url: "https://example.com/t.jpg", width: 1280, height: 720 },
    embedUrl: "https://example.com/embed",
    permalink: "https://example.com/p",
  };
  assert.equal(buildClip({ ...rawBase, title: "", description: "" }), null, "empty title+description must be dropped");
  assert.ok(buildClip({ ...rawBase, title: "หัวข้อข่าว", description: "" }) !== null, "a real title alone must still produce a clip");
  // A hashtags-only description is NOT the empty case: deriveArticle falls
  // back to the tag words themselves as the headline (see the "only-hashtags"
  // deriveArticle test above), so buildClip must still keep it.
  assert.ok(buildClip({ ...rawBase, title: "", description: "#a #b" }) !== null, "hashtags-only description still has a tag-derived title and must be kept");
  console.log("ok  buildClip: drops a clip with no usable headline, keeps one with a real title");

  // F: Facebook's Graph API emits `created_time` as `...+0000` (basic
  // ISO-8601 offset), invalid in the extended format this app emits
  // everywhere (JSON-LD, HTML datetime). toIso must re-serialize it valid.
  const fbBasic = toIso("2026-08-21T15:47:15+0000", "fallback");
  assert.notEqual(fbBasic, "fallback", "a valid Facebook timestamp must not fall back");
  assert.match(fbBasic, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `${fbBasic} is not valid extended ISO-8601`);
  assert.equal(Date.parse(fbBasic), Date.parse("2026-08-21T15:47:15+0000"), "toIso must preserve the same instant");
  assert.equal(toIso(undefined, "fallback"), "fallback", "a missing timestamp must use the fallback");
  assert.equal(toIso("not-a-date", "fallback"), "fallback", "an unparseable timestamp must use the fallback, not NaN");
  console.log("ok  toIso: Facebook's +0000 basic offset -> valid extended ISO-8601, same instant, safe fallback");

  await mostViewedChecks();
  await sourceArticleChecks();
}

/**
 * getMostViewedThisMonth's window+sort logic, tested through the pure
 * pickMostViewedThisMonth split-out (see clips.ts) so it doesn't depend on
 * getClips()'s live/sample provider selection.
 */
async function mostViewedChecks() {
  const base: Omit<Clip, "id" | "publishedAt" | "views"> = {
    slug: "s",
    source: "facebook",
    title: "t",
    summary: "s",
    body: "b",
    category: "viral",
    updatedAt: "2026-01-01T00:00:00.000Z",
    durationSec: 30,
    thumbnail: { url: "https://example.com/t.jpg", width: 720, height: 1280 },
    embedUrl: "https://example.com/embed",
    permalink: "https://example.com/p",
    tags: [],
  };
  const clip = (id: string, publishedAt: string, views: number | undefined): Clip => ({
    ...base,
    id,
    slug: id,
    publishedAt,
    views,
  });

  // Bangkok is UTC+7, so its month rolls over 7 hours before UTC's does.
  // now = 2026-03-01T02:00:00Z is already 2026-03-01 09:00 in Bangkok, so
  // "this month" is March in Bangkok. Bangkok's month start as a UTC instant
  // is 2026-02-28T17:00:00Z.
  const now = new Date("2026-03-01T02:00:00Z");

  // Published 2026-02-28T18:00:00Z: February in UTC, but 2026-03-01T01:00
  // +07:00 in Bangkok — i.e. last month in UTC, THIS month in Bangkok. A
  // naive UTC-month boundary would wrongly exclude it.
  const straddler = clip("straddler", "2026-02-28T18:00:00.000Z", 10);
  // Clearly last month on both sides — must never appear.
  const lastMonth = clip("last-month", "2026-01-15T10:00:00.000Z", 999);
  // Clearly this month, higher views — must sort first.
  const topThisMonth = clip("top", "2026-03-05T10:00:00.000Z", 500);
  // In-window but no real view count — must be excluded, not treated as 0.
  const noViews = clip("no-views", "2026-03-02T00:00:00.000Z", undefined);
  const zeroViews = clip("zero-views", "2026-03-02T00:00:00.000Z", 0);
  // In-window, mid views, published earlier than `topThisMonth` — used to
  // prove the publishedAt tie-break only kicks in on an actual views tie.
  const midThisMonth = clip("mid", "2026-03-01T03:00:00.000Z", 50);

  const picked = pickMostViewedThisMonth(
    [lastMonth, topThisMonth, noViews, zeroViews, midThisMonth, straddler],
    5,
    now,
  );
  assert.deepEqual(
    picked.map((c) => c.id),
    ["top", "mid", "straddler"],
    "Bangkok month window + views-descending order",
  );
  console.log("ok  pickMostViewedThisMonth: UTC/Bangkok month-boundary straddle lands correctly, excludes 0/undefined views, sorts by views desc");

  // Views-tie: publishedAt desc breaks it, deterministically.
  const tieOlder = clip("tie-older", "2026-03-01T00:00:01.000Z", 20);
  const tieNewer = clip("tie-newer", "2026-03-10T00:00:00.000Z", 20);
  const tied = pickMostViewedThisMonth([tieOlder, tieNewer], 5, now);
  assert.deepEqual(tied.map((c) => c.id), ["tie-newer", "tie-older"], "equal views break the tie by newest publishedAt");
  console.log("ok  pickMostViewedThisMonth: equal-views tie-break is publishedAt desc");

  // n caps the result.
  assert.equal(pickMostViewedThisMonth([topThisMonth, midThisMonth, straddler], 2, now).length, 2, "slices to n");

  // Wired end-to-end: must not throw against whatever getClips() actually
  // returns (sample data here — no FB/YT env set), even though sample clips
  // carry no views and so yield an empty result.
  assert.deepEqual(await getMostViewedThisMonth(), [], "sample clips have no views — nothing qualifies");
  console.log("ok  getMostViewedThisMonth: wired to getClips(), returns [] when no clip has a real view count");
}

/**
 * The source-article path, with `fetch` stubbed — no network, no live token.
 * Two things must hold no matter what a publisher serves: the excerpt is
 * capped, and any failure degrades to the honest placeholder instead of
 * throwing (a throw here would take a whole page build down).
 */
async function sourceArticleChecks() {
  const realFetch = globalThis.fetch;
  process.env.FB_PAGE_ID = "PAGE";
  process.env.FB_ACCESS_TOKEN = "TOKEN";

  const commentPayload = (url: string) => ({
    data: [
      // The affiliate comment is posted by the SAME author — only the marker
      // separates it from the real source link.
      { message: `พิกัดสินค้า https://s.shopee.co.th/abc123`, from: { id: "PAGE" } },
      { message: `อ่านเพิ่มเติม\n ${url}`, from: { id: "PAGE" } },
    ],
  });

  const stub = (page: () => Promise<Response> | Response, url = "https://www.sanook.com/news/1") => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const href = String(input instanceof Request ? input.url : input);
      if (href.includes("graph.facebook.com")) {
        return new Response(JSON.stringify(commentPayload(url)), {
          headers: { "content-type": "application/json" },
        });
      }
      return page();
    }) as typeof fetch;
  };

  // 1. A publisher serving a very long description + long paragraphs must
  //    still come back at or under the cap, cut on a real Thai word boundary.
  const long = "ผู้สื่อข่าวรายงานว่าเจ้าหน้าที่ตำรวจได้เข้าตรวจค้นพื้นที่เป้าหมายเมื่อเวลาเช้าตรู่ที่ผ่านมา".repeat(20);
  stub(
    () =>
      new Response(
        `<html><head><meta property="og:description" content="${long}">` +
          `<meta property="og:site_name" content="www.sanook.com/news"></head>` +
          `<body><p>${long}</p><p>${long}</p></body></html>`,
        { headers: { "content-type": "text/html" } },
      ),
  );
  const capped = await getSourceArticle("video-cap");
  assert.ok(capped, "stubbed source article must resolve");
  assert.ok(
    capped.excerpt.length <= SOURCE_EXCERPT_MAX,
    `excerpt ${capped.excerpt.length} exceeds the ${SOURCE_EXCERPT_MAX}-char cap`,
  );
  assert.ok(capped.excerpt.endsWith("…"), "a capped excerpt must be visibly truncated");
  assert.equal(capped.publisher, "Sanook", "publisher must be a display name, not a hostname");
  assert.equal(capped.url, "https://www.sanook.com/news/1", "must take the marker URL, not the Shopee link");
  console.log(`ok  getSourceArticle: excerpt capped at ${capped.excerpt.length} <= ${SOURCE_EXCERPT_MAX}, publisher named, affiliate link ignored`);

  // Cap holds at the boundary regardless of input length.
  for (const n of [1, 599, 600, 601, 5000]) {
    assert.ok(truncate("ก".repeat(n), SOURCE_EXCERPT_MAX).length <= SOURCE_EXCERPT_MAX);
  }
  console.log("ok  truncate: never exceeds the cap for any input length");

  // 2. An unreachable source host must return null, never throw — the clip
  //    keeps the honest placeholder body.
  stub(() => {
    throw new Error("getaddrinfo ENOTFOUND unreachable.invalid");
  }, "https://unreachable.invalid/news/1");
  const dead = await getSourceArticle("video-dead");
  assert.equal(dead, null, "an unreachable host must yield null, not a throw");

  // A 403 (khaosod behind Cloudflare, live) is the same story.
  stub(() => new Response("Just a moment...", { status: 403 }), "https://www.khaosod.co.th/x/news_1");
  assert.equal(await getSourceArticle("video-403"), null, "a 403 must yield null");

  // And a video whose Page comment carries no link at all.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ data: [{ message: "อ่านเพิ่มเติม เร็วๆ นี้", from: { id: "PAGE" } }] }), {
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  assert.equal(await getSourceArticle("video-nolink"), null, "a marker comment with no URL must yield null");

  // The fallback body is the placeholder, unchanged and unfabricated.
  const fallback = deriveArticle("", "ด่วน! น้ำท่วมเชียงใหม่");
  assert.ok(fallback.body.includes(PLACEHOLDER), "a clip with no source article keeps the placeholder");
  console.log("ok  getSourceArticle: unreachable host / 403 / link-less comment all fall back to the placeholder without throwing");

  globalThis.fetch = realFetch;
  delete process.env.FB_PAGE_ID;
  delete process.env.FB_ACCESS_TOKEN;
}

main();
