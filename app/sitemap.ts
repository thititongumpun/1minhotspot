import type { MetadataRoute } from "next";
import { getClips } from "@/lib/clips";
import { getAllClipRefs, getCategoryLastMod, type ClipRef } from "@/lib/store";
import { absoluteUrl } from "@/lib/seo";
import { CATEGORIES } from "@/lib/types";
import type { Clip } from "@/lib/types";

// sitemap.ts is a Route Handler, cached indefinitely by default — without this
// the file is frozen at build time and every clip published after the last
// deploy is invisible to Google. Matches the 3600 every page already exports.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The store is the complete record and the only uncapped source — getClips()
  // stops at DEFAULT_LIMIT, which silently drops every older article from the
  // sitemap once the table outgrows it. Fresh clips not yet archived are not a
  // gap worth reading 500 fat rows for: news-sitemap.xml is what Google News
  // polls for the 48h window, and any clip lands here on the next revalidate.
  const stored = await getAllClipRefs();
  const catLastMod = await getCategoryLastMod();
  // One live read serves both fallbacks; getClips() rides load()'s Data Cache
  // so a second call inside the same render is free.
  const live: Clip[] = stored.length === 0 || catLastMod.size === 0 ? await getClips() : [];
  const clips: ClipRef[] =
    stored.length > 0
      ? stored
      : // No database (local dev, or a failed query): fall back to the live
        // feed. Sample clips are fabricated — browsable locally, never Google's.
        live
          .filter((c) => c.source !== "sample" || process.env.NODE_ENV !== "production")
          .map((c) => ({ slug: c.slug, updatedAt: c.updatedAt }));

  return [
    // Home — request-time new Date() is not a real modification date. Once Google
    // sees unreliable lastmod values site-wide, it discards them entirely, throwing
    // away the accurate dates on clip URLs. Leave it omitted here (MetadataRoute.Sitemap
    // types it as optional).
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 0.8,
    },
    // Videos listing
    {
      url: absoluteUrl("/videos"),
      changeFrequency: "daily",
      priority: 0.7,
    },
    // Static AdSense-prerequisite pages
    ...(["/about", "/privacy", "/contact"] as const).map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    // Category indexes — the real max(updated_at) of that category's clips.
    // A category with no clips gets NO lastmod at all: omitting it is honest,
    // `new Date()` was not.
    ...CATEGORIES.map((category) => {
      const fromLive = live
        .filter((c) => c.category === category.slug)
        .reduce<string | undefined>((max, c) => (!max || c.updatedAt > max ? c.updatedAt : max), undefined);
      const lastMod = catLastMod.get(category.slug) ?? fromLive;
      return {
        url: absoluteUrl(`/category/${category.slug}`),
        ...(lastMod ? { lastModified: new Date(lastMod) } : {}),
        changeFrequency: "daily" as const,
        priority: 0.6,
      };
    }),
    // Article pages — highest priority, the SEO surface.
    // absoluteUrl percent-encodes each segment, so Thai slugs never reach
    // <loc> as raw UTF-8.
    ...clips.map((clip) => ({
      url: absoluteUrl(`/news/${clip.slug}`),
      lastModified: new Date(clip.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
