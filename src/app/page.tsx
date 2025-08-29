import { TrendingUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getNewsData } from "@/lib/server-news";
import NewsClient from "@/components/news-client";
import FloatingYouTubeButton from "@/components/floating-youtube-button";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { news } = await getNewsData();

  return {
    title:
      "สรุปข่าวร้อนใน 1 นาที | ข่าวล่าสุด " +
      new Date().toLocaleDateString("th-TH"),
    description: `ข่าวล่าสุด ${news.length} ข่าว อัปเดตทุกชั่วโมง เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1 นาที`,
    openGraph: {
      title: "สรุปข่าวร้อนใน 1 นาที | ข่าวล่าสุด",
      description: `ข่าวล่าสุด ${news.length} ข่าว อัปเดตทุกชั่วโมง`,
    },
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export const revalidate = 3600; // Revalidate every hour

export default async function NewsPage() {
  const { news: newsData, lastUpdated } = await getNewsData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 md:sticky md:top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-slate-900 to-slate-600 p-2 rounded-lg">
                  <Image
                    src="/logobro.png"
                    alt="1minhotspot"
                    width={40}
                    height={40}
                    priority
                    sizes="40px"
                  />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                  สรุปข่าวร้อนใน 1 นาที
                </h1>
              </div>
              <div className="flex items-center gap-4">
                {/* Header content can be added here if needed */}
              </div>
            </div>

            <div className="max-w-4xl">
              <h2 className="text-slate-600 text-base md:text-lg font-medium leading-relaxed">
                เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1
                นาที! ติดตามทุกประเด็นสำคัญแบบไว รู้ทันโลก ไม่พลาดทุกกระแส
                เหมาะสำหรับคนไม่มีเวลา แต่อยากรู้ครบ จบไว อัปเดตใหม่ทุกวัน
              </h2>
              <div className="text-sm text-slate-500 mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  ข่าวล่าสุด
                </span>
                <span>•</span>
                <time dateTime={lastUpdated}>
                  อัปเดต{" "}
                  {new Date(lastUpdated).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}{" "}
                  เวลา{" "}
                  {new Date(lastUpdated).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          </div>
        </div>
      </header>

      <NewsClient initialNews={newsData} />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsMediaOrganization",
            name: "1minhotspot",
            url: "https://1minhotspot.vercel.app",
            logo: "https://1minhotspot.vercel.app/logobro.png",
            description:
              "เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1 นาที",
            sameAs: ["https://www.youtube.com/@1minhotspot"],
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: newsData.length,
              itemListElement: newsData.slice(0, 10).map((item, index) => ({
                "@type": "NewsArticle",
                position: index + 1,
                headline: item.title,
                description: item.description,
                image: item.thumbnail,
                datePublished: item.publishedAt,
                author: {
                  "@type": "Organization",
                  name: "1minhotspot",
                },
                publisher: {
                  "@type": "Organization",
                  name: "1minhotspot",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://1minhotspot.vercel.app/logobro.png",
                  },
                },
              })),
            },
          }),
        }}
      />

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200/50 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-slate-600">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="bg-gradient-to-r from-slate-900 to-slate-600 p-1.5 rounded">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">สรุปข่าวร้อนใน 1 นาที</span>
            </div>
            <p className="mb-2 text-sm">
              © {new Date().getFullYear()} สรุปข่าวร้อนใน 1 นาที.
              รับข่าวสารอย่างรวดเร็วในเวลาเพียงหนึ่งนาที
            </p>
          </div>
        </div>
      </footer>

      <FloatingYouTubeButton />
    </div>
  );
}
