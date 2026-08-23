import type { MetadataRoute } from "next";
import { getClips } from "@/lib/clips";
import { absoluteUrl } from "@/lib/seo";
import { CATEGORIES } from "@/lib/types";

// sitemap.ts is a Route Handler, cached indefinitely by default — without this
// the file is frozen at build time and every clip published after the last
// deploy is invisible to Google. Matches the 3600 every page already exports.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clips = (await getClips()).filter(
    // Sample clips are fabricated. Keep them locally so the site is browsable,
    // never hand them to Google.
    (clip) => clip.source !== "sample" || process.env.NODE_ENV !== "production",
  );

  return [
    // Home
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    // Videos listing
    {
      url: absoluteUrl("/videos"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    // Category indexes
    ...CATEGORIES.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
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
