import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: [absoluteUrl("/sitemap.xml"), absoluteUrl("/news-sitemap.xml")],
    // `host` is Yandex-only (deprecated there too); every other crawler
    // ignores it, and it duplicates what `sitemap`/canonical tags already say.
  };
}
