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
].join(",");

/** The retry field list, if Graph ever rejects `views` (see fetchFacebookClips).
 *  Split/filter rather than a string replace so it stays correct wherever
 *  `views` sits in FIELDS — including first, where there is no leading comma.
 *  Exported for the self-check in facebook.test.ts. */
export const FIELDS_WITHOUT_VIEWS = FIELDS.split(",")
  .filter((f) => f !== "views")
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
type GraphVideo = {
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

export async function fetchFacebookClips(): Promise<Clip[]> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_ACCESS_TOKEN;
  const version = process.env.FB_API_VERSION || "v26.0";
  if (!pageId || !token) return [];

  const fetchGraph = async (fields: string): Promise<GraphResponse> => {
    const url =
      `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/videos` +
      `?fields=${fields}&limit=50&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = (await res.json().catch(() => ({}))) as GraphResponse;
    if (!res.ok || json.error) {
      throw new Error(`Facebook Graph ${res.status}: ${json.error?.message ?? res.statusText}`);
    }
    return json;
  };

  // Graph fails the WHOLE request on one unrecognised/unpermitted field, and
  // the caller's catch turns that into sample data — fabricated stories on a
  // live news site. `views` is confirmed on v26.0 with the dev token, but not
  // on the production token, a FB_API_VERSION bump, or the day Meta drops the
  // field. Retry once without it: a rejection then costs the ranking section,
  // not the site. buildClip already treats `views: undefined` as "no count".
  let json: GraphResponse;
  try {
    json = await fetchGraph(FIELDS);
  } catch (err) {
    console.error("[facebook] retrying without `views`:", (err as Error).message);
    json = await fetchGraph(FIELDS_WITHOUT_VIEWS);
  }

  return (json.data ?? [])
    .filter((v) => typeof v.length === "number" && v.length > 0 && v.length <= MAX_DURATION_SEC)
    .map((v) => {
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
      });
    })
    // No usable thumbnail (neither `thumbnails` nor `picture`) — drop the
    // clip rather than emit `<img src="">` / an empty JSON-LD image array,
    // which is invalid and gets the NewsArticle rich result dropped by
    // Google. We never invent an image URL that might not resolve.
    .filter((c): c is Clip => c !== null);
}
