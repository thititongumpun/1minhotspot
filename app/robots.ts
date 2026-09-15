import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // /api/hot is JSON for the Facebook job; /v/:id only 301s to the slug.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v/"] },
    sitemap: [absoluteUrl("/sitemap.xml"), absoluteUrl("/news-sitemap.xml")],
    // `host` is Yandex-only (deprecated there too); every other crawler
    // ignores it, and it duplicates what `sitemap`/canonical tags already say.
  };
}
