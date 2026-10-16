import { notFound } from "next/navigation";
import { getPromotion } from "@/lib/store";

// Outbound CTA redirect for a promotion: /go/<slug>/<n> -> links[n] + utm tags.
// Targets come only from D1 (https links written by scripts/promo-add.ts), so
// this is not an open redirect. Clicks are counted from zone analytics on this
// path; nothing is written here.
export async function GET(_req: Request, ctx: RouteContext<"/go/[slug]/[n]">): Promise<Response> {
  const { slug, n } = await ctx.params;
  if (!/^\d{1,2}$/.test(n)) notFound();
  const promo = await getPromotion(slug);
  if (!promo || promo.endsAt <= new Date().toISOString()) notFound();
  const link = promo.links[Number(n)];
  if (!link || !link.url.startsWith("https://")) notFound();
  const url = new URL(link.url);
  url.searchParams.set("utm_source", "1minhotspot");
  url.searchParams.set("utm_medium", "promo");
  url.searchParams.set("utm_campaign", slug);
  return new Response(null, { status: 302, headers: { location: url.href, "cache-control": "no-store" } });
}
