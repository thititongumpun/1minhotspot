import type { NextRequest } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { getHot } from "@/lib/store";

// Reading searchParams makes this handler dynamic, so `revalidate` only
// documents intent; the Cache-Control below is what actually caches at the
// edge and in clients.
export const revalidate = 300;

/** Integer query param with a default, clamped to [min, max]. */
const int = (v: string | null, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
};

/** Most-viewed clips of the last N hours, for external consumers (bots, widgets). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const hours = int(q.get("hours"), 6, 1, 72);
  const limit = int(q.get("limit"), 20, 1, 50);

  const items = (await getHot(hours, limit)).map((clip) => ({
    id: clip.id,
    title: clip.title,
    body: clip.body,
    category: clip.category,
    views: clip.views,
    publishedAt: clip.publishedAt,
    url: absoluteUrl(`/news/${clip.slug}`),
  }));

  return Response.json(items, { headers: { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } });
}
