import { permanentRedirect, notFound } from "next/navigation";
import { archiveFreshClip, getClips, revalidateClipLists } from "@/lib/clips";
import { getStoredRefById } from "@/lib/store";

/**
 * Stable id-based entry point: /v/<facebook video id> -> /news/<slug>.
 *
 * n8n posts this URL as the first comment on each Reel seconds after publish,
 * before the clip is archived, and the slug depends on the rewritten title —
 * so n8n can't (and shouldn't) compute the slug itself. The store answers for
 * archived clips. getClips() covers the feed's last hourly snapshot (its Graph
 * fetch sits in the Data Cache for 3600s even on this dynamic route). A reel
 * newer than that snapshot is fetched by id, uncached, and archived — the
 * next hit answers from the store.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{5,}$/.test(id)) notFound();
  let slug =
    (await getStoredRefById(id))?.slug ?? (await getClips()).find((c) => c.id === id)?.slug ?? null;
  if (!slug) {
    const fresh = await archiveFreshClip(id);
    if (!fresh) notFound();
    slug = fresh.slug;
    // The reel is in the store now but every list still shows the hour-old
    // snapshot — flush them so the news sitemap carries it on the next crawl.
    revalidateClipLists(fresh.category);
  }
  permanentRedirect(`/news/${encodeURIComponent(slug)}`);
}
