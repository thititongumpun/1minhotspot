import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // /api/hot is JSON for the Facebook job. /v/:id must stay crawlable: it is
    // the link n8n comments on every Reel, and Facebook honours robots.txt —
    // with it disallowed the scraper reported 403 and the comment card was a
    // bare "1minhotspot.com". Google just follows the 301 to the canonical slug.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: [absoluteUrl("/sitemap.xml"), absoluteUrl("/news-sitemap.xml")],
    // `host` is Yandex-only (deprecated there too); every other crawler
    // ignores it, and it duplicates what `sitemap`/canonical tags already say.
  };
}
