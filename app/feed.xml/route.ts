import { getClips } from "@/lib/clips";
import { absoluteUrl, clipDescription, escapeXml, SITE_DESCRIPTION } from "@/lib/seo";
import { categoryLabel } from "@/lib/types";

export const revalidate = 3600;

const TITLE = "สรุปข่าวร้อนใน 1 นาที";
const MAX_ITEMS = 50;

/** RSS 2.0. The content source for Google Publisher Center and feed readers. */
export async function GET() {
  const items = (await getClips())
    .filter((clip) => clip.source !== "sample" || process.env.NODE_ENV !== "production")
    .slice(0, MAX_ITEMS);

  const entries = items.map((clip) => {
    const link = escapeXml(absoluteUrl(`/news/${clip.slug}`));
    // List rows carry no body (lib/store.ts), so this is usually absent; RSS
    // only requires one of title/description, and an empty element reads as
    // a broken feed in Publisher Center's preview.
    const description = clipDescription(clip);
    return `    <item>
      <title>${escapeXml(clip.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(clip.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(categoryLabel(clip.category))}</category>${
        description ? `\n      <description>${escapeXml(description)}</description>` : ""
      }
      <enclosure url="${escapeXml(clip.thumbnail.url)}" type="image/jpeg" length="0" />
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${escapeXml(absoluteUrl("/"))}</link>
    <atom:link href="${escapeXml(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>th</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${entries.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
