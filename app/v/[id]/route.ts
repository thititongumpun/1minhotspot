import { permanentRedirect, notFound } from "next/navigation";
import { getClips } from "@/lib/clips";
import { getStoredSlugById } from "@/lib/store";

/**
 * Stable id-based entry point: /v/<facebook video id> -> /news/<slug>.
 *
 * n8n posts this URL as the first comment on each Reel seconds after publish,
 * before the clip is archived, and the slug depends on the rewritten title —
 * so n8n can't (and shouldn't) compute the slug itself. The store answers for
 * archived clips; getClips() covers a just-published one by pulling the live
 * feed, which archives it on the way.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{5,}$/.test(id)) notFound();
  const slug =
    (await getStoredSlugById(id)) ?? (await getClips()).find((c) => c.id === id)?.slug ?? null;
  if (!slug) notFound();
  permanentRedirect(`/news/${encodeURIComponent(slug)}`);
}
