import { getClips } from "@/lib/clips";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

const PUBLICATION_NAME = "สรุปข่าวร้อนใน 1 นาที";
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000; // Google News rejects entries older than 48h.

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const now = Date.now();
  const fresh = (await getClips()).filter(
    (clip) =>
      now - Date.parse(clip.publishedAt) <= NEWS_WINDOW_MS &&
      // Sample clips are fabricated stories; never submit them to Google News.
      (clip.source !== "sample" || process.env.NODE_ENV !== "production"),
  );

  const urlEntries = fresh.map((clip) => {
    // absoluteUrl percent-encodes each path segment, so a Thai slug never
    // reaches <loc> as raw UTF-8.
    const loc = escapeXml(absoluteUrl(`/news/${clip.slug}`));
    const title = escapeXml(clip.title);
    const pubDate = new Date(clip.publishedAt).toISOString();
    return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>th</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlEntries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "content-type": "application/xml" },
  });
}
