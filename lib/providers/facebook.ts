import type { Clip } from "../types";
import { buildClip } from "../normalize";

// NOTE: we read from the /videos edge, NOT /video_reels. The reels edge is a
// *publishing* endpoint — its read support is undocumented and unreliable, and
// it omits `length`/`thumbnails`. Reels published by the Page show up on
// /videos anyway, so we read there and filter by duration instead.
// NOTE: `source` (the raw media URL) is deliberately NOT requested — it's
// permission-sensitive, nothing here reads it, and if Graph rejects it for
// the token's scopes the *entire* request throws, silently dropping the
// whole site to sample data. Pure downside for a field we never use.
// `views` (not `post_views`, which reads 0/near-0 — a different metric) is the
// reel play count Graph actually tracks on this edge, confirmed live: v26.0
// GET /{page-id}/videos?fields=...,views returns e.g. {"views":89}.
const FIELDS = [
  "id",
  "title",
  "description",
  "permalink_url",
  "created_time",
  "updated_time",
  "length",
  "picture",
  "thumbnails{uri,width,height}",
  "format",
  "views",
  // Engagement counts for the article page. `.limit(0)` keeps the edge data
  // empty so only `summary.total_count` comes back — no comment text, no
  // extra permission surface. Confirmed live on v26.0 alongside `views`.
  "likes.summary(true).limit(0)",
  "comments.summary(true).limit(0)",
].join(",");

/** The retry field list, if Graph ever rejects `views`/`likes`/`comments`
 *  (see fetchFacebookClips). All three engagement fields go together: they
 *  are the same permission class, and one retry is all graphGet makes.
 *  Split/filter rather than a string replace so it stays correct wherever
 *  `views` sits in FIELDS — including first, where there is no leading comma.
 *  Exported for the self-check in facebook.test.ts. */
export const FIELDS_WITHOUT_VIEWS = FIELDS.split(",")
  .filter((f) => !/^(views|likes|comments)\b/.test(f))
  .join(",");

const MAX_DURATION_SEC = 90;

// `thumbnails` returns ~11 *different frames*, all at the reel's native
// 1080x1920 — there is no smaller size in there. `format` returns the one
// preferred frame at 130/480/720/native instead. With Image Optimization off
// the native still ships ~160 KB into a 16:9 slot that crops away most of it;
// the 720 variant is ~62 KB of the same rendered pixels. 720 rather than 480
// because the lead runs to 60vw and `object-cover` uses the full width.
const TARGET_THUMB_WIDTH = 720;

type GraphThumb = { uri?: string; width?: number; height?: number };
type GraphFormat = { filter?: string; picture?: string; width?: number; height?: number };
export type GraphVideo = {
  id: string;
  title?: string;
  description?: string;
  permalink_url?: string;
  created_time?: string;
  updated_time?: string;
  length?: number;
  picture?: string;
  thumbnails?: { data?: GraphThumb[] };
  format?: GraphFormat[];
  views?: number;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};
type GraphResponse = { data?: GraphVideo[]; error?: { message?: string; type?: string; code?: number } };

const absolute = (permalink: string) =>
  permalink.startsWith("http") ? permalink : `https://www.facebook.com${permalink}`;

/**
 * Graph API emits dates as `2026-08-21T15:47:15+0000` — a basic ISO-8601
 * offset (`±hhmm`), which the *extended* ISO-8601 format used everywhere we
 * emit dates (JSON-LD, HTML `datetime`) forbids. `Date` parses it fine either
 * way; `toISOString()` re-serializes it in the valid `+00:00`/`Z` form.
 */
export function toIso(fbTime: string | undefined, fallback: string): string {
  if (!fbTime) return fallback;
  const d = new Date(fbTime);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

/** Smallest `format` variant still wide enough to render, or null when Graph
 *  sent no usable one — callers fall through to `thumbnails`/`picture`. */
export function pickFormat(
  formats: GraphFormat[] | undefined,
): { url: string; width: number; height: number } | null {
  const usable = (formats ?? [])
    .filter((f): f is Required<GraphFormat> => Boolean(f.picture && f.width && f.height))
    .sort((a, b) => a.width - b.width);
  const pick = usable.find((f) => f.width >= TARGET_THUMB_WIDTH) ?? usable.at(-1);
  return pick ? { url: pick.picture, width: pick.width, height: pick.height } : null;
}

/** One Graph video → Clip, or null when it is not reel-length or has no usable still.
 *  Shared by the feed and the by-id fetch, so both write the same slug/row.
 *  Exported for facebook.test.ts. */
export function toClip(v: GraphVideo, pageId: string): Clip | null {
  if (!(typeof v.length === "number" && v.length > 0 && v.length <= MAX_DURATION_SEC)) return null;
  const permalink = absolute(v.permalink_url ?? `/${pageId}/videos/${v.id}`);
  const thumb = (v.thumbnails?.data ?? [])
    .filter((t): t is Required<GraphThumb> => Boolean(t.uri && t.width && t.height))
    .sort((a, b) => b.width - a.width)[0];
  // Graph gives no dimensions for `picture`; 16:9 is the reel still it serves.
  const thumbnail =
    pickFormat(v.format) ??
    (thumb
      ? { url: thumb.uri, width: thumb.width, height: thumb.height }
      : v.picture
        ? { url: v.picture, width: 1280, height: 720 }
        : null);
  // No usable thumbnail (neither `thumbnails` nor `picture`) — drop the
  // clip rather than emit `<img src="">` / an empty JSON-LD image array,
  // which is invalid and gets the NewsArticle rich result dropped by
  // Google. We never invent an image URL that might not resolve.
  if (!thumbnail) return null;
  const publishedAt = toIso(v.created_time, new Date(0).toISOString());
  return buildClip({
    id: v.id,
    source: "facebook",
    title: v.title ?? "",
    description: v.description ?? "",
    publishedAt,
    updatedAt: v.updated_time ? toIso(v.updated_time, publishedAt) : undefined,
    durationSec: Math.round(v.length as number),
    thumbnail,
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(permalink)}&show_text=false`,
    permalink,
    views: typeof v.views === "number" ? v.views : undefined,
    likes: v.likes?.summary?.total_count,
    comments: v.comments?.summary?.total_count,
  });
}

/**
 * GET graph.facebook.com/{version}/{path}?fields=... Graph fails the WHOLE
 * request on one unrecognised/unpermitted field, and fetchFacebookClips's
 * caller turns that into sample data — fabricated stories on a live news
 * site. `views` is confirmed on v26.0 with the dev token, but not on the
 * production token, a FB_API_VERSION bump, or the day Meta drops the field.
 * Retry once without it: a rejection then costs the ranking section, not the
 * site. buildClip already treats `views: undefined` as "no count".
 */
async function graphGet<T extends { error?: GraphResponse["error"] }>(
  path: string,
  token: string,
  init: RequestInit,
  query = "",
): Promise<T> {
  const version = process.env.FB_API_VERSION || "v26.0";
  const get = async (fields: string): Promise<T> => {
    const url =
      `https://graph.facebook.com/${version}/${path}` +
      `?fields=${fields}${query}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as T;
    if (!res.ok || json.error) {
      throw new Error(`Facebook Graph ${res.status}: ${json.error?.message ?? res.statusText}`);
    }
    return json;
  };
  try {
    return await get(FIELDS);
  } catch (err) {
    console.error("[facebook] retrying without `views`:", (err as Error).message);
    return get(FIELDS_WITHOUT_VIEWS);
  }
}

export async function fetchFacebookClips(): Promise<Clip[]> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_ACCESS_TOKEN;
  if (!pageId || !token) return [];

  const json = await graphGet<GraphResponse>(
    `${encodeURIComponent(pageId)}/videos`,
    token,
    { next: { revalidate: 3600 } },
    "&limit=50",
  );
  return (json.data ?? []).map((v) => toClip(v, pageId)).filter((c): c is Clip => c !== null);
}

/**
 * One video by id, bypassing the Data Cache. The /videos feed above is cached
 * for an hour, so a reel published minutes ago is invisible to it; this is
 * how /v/<id> finds that reel. Never throws: null on missing creds, a Graph
 * error, or a video that is not reel-length — the caller 404s, as before.
 */
export async function fetchFacebookVideo(id: string): Promise<Clip | null> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_ACCESS_TOKEN;
  if (!pageId || !token) return null;
  try {
    const v = await graphGet<GraphVideo & { error?: GraphResponse["error"] }>(
      encodeURIComponent(id),
      token,
      { cache: "no-store" },
    );
    return toClip(v, pageId);
  } catch (err) {
    console.error(`[facebook] video ${id}:`, (err as Error).message);
    return null;
  }
}
