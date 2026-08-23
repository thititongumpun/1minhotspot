import type { Clip } from "../types";
import { buildClip } from "../normalize";

const MAX_DURATION_SEC = 90;

/** ISO-8601 duration → seconds. Handles PT47S, PT1M3S, PT1H2M3S, P1DT2H. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(iso.trim());
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Math.round(Number(s ?? 0))
  );
}

type Thumb = { url: string; width: number; height: number };
type SearchItem = { id?: { videoId?: string } };
type VideoItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    tags?: string[];
    thumbnails?: Record<string, Thumb | undefined>;
  };
  contentDetails?: { duration?: string };
};
type ApiError = { error?: { message?: string } };

const api = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const json = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok || json.error) {
    throw new Error(`YouTube API ${res.status}: ${json.error?.message ?? res.statusText}`);
  }
  return json;
};

const bestThumb = (thumbs: Record<string, Thumb | undefined> = {}): Thumb =>
  ["maxres", "standard", "high", "medium", "default"]
    .map((k) => thumbs[k])
    .find((t): t is Thumb => Boolean(t?.url)) ?? { url: "", width: 1280, height: 720 };

export async function fetchYouTubeClips(): Promise<Clip[]> {
  // API-key auth only. The repo's client_secrets.json is an OAuth *desktop*
  // client and cannot authorise server-side public reads — never attempt OAuth.
  const key = process.env.YT_API_KEY;
  const channelId = process.env.YT_CHANNEL_ID;
  if (!key || !channelId) return [];

  const search = await api<{ items?: SearchItem[] }>("search", {
    key,
    channelId,
    part: "id",
    order: "date",
    type: "video",
    maxResults: "50",
  });
  const ids = (search.items ?? []).map((i) => i.id?.videoId).filter((v): v is string => Boolean(v));
  if (ids.length === 0) return [];

  const videos = await api<{ items?: VideoItem[] }>("videos", {
    key,
    id: ids.join(","),
    part: "snippet,contentDetails",
  });

  return (videos.items ?? [])
    .map((v) => ({ v, durationSec: parseIsoDuration(v.contentDetails?.duration ?? "") }))
    .filter(({ durationSec }) => durationSec > 0 && durationSec <= MAX_DURATION_SEC)
    .map(({ v, durationSec }) =>
      // `snippet.publishedAt` is already RFC 3339 with a `Z`/`+hh:mm` offset —
      // valid extended ISO-8601 as-is, unlike Facebook's `created_time`.
      buildClip({
        id: v.id,
        source: "youtube",
        title: v.snippet?.title ?? "",
        description: v.snippet?.description ?? "",
        publishedAt: v.snippet?.publishedAt ?? new Date(0).toISOString(),
        durationSec,
        thumbnail: bestThumb(v.snippet?.thumbnails),
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        permalink: `https://www.youtube.com/watch?v=${v.id}`,
        tags: v.snippet?.tags ?? [],
      }),
    )
    .filter((c): c is Clip => c !== null);
}
