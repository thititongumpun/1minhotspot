import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getNewsData } from "@/lib/server-news";
import { createSlug, findNewsBySlug } from "@/lib/url-utils";
import type { Metadata } from "next";

export const revalidate = 3600; // Revalidate every hour

interface NewsPageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: NewsPageProps): Promise<Metadata> {
  const { news } = await getNewsData();
  const { id } = await params;
  const newsItem = findNewsBySlug(news, id);

  if (!newsItem) {
    return {
      title: "ไม่พบข่าว | 1minhotspot",
    };
  }

  return {
    title: `${newsItem.title}`,
    description:
      newsItem.fullDescription || newsItem.description || newsItem.title,
    openGraph: {
      title: newsItem.title,
      description:
        newsItem.fullDescription || newsItem.description || newsItem.title,
      images: newsItem.thumbnail ? [newsItem.thumbnail] : [],
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

export async function generateStaticParams() {
  const { news } = await getNewsData();
  return news.map((item) => ({
    id: createSlug(item.englishTitle || item.title || ""),
  }));
}

export default async function NewsDetailPage({ params }: NewsPageProps) {
  const { news } = await getNewsData();
  const { id } = await params;
  const newsItem = findNewsBySlug(news, id);

  if (!newsItem) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าหลัก
        </Link>

        <article className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Thumbnail */}
          {newsItem.thumbnail && (
            <div className="relative h-64 md:h-80 bg-slate-100">
              <Image
                src={newsItem.thumbnail}
                alt={newsItem.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="p-6">
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 leading-tight">
              {newsItem.title}
            </h1>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
              {newsItem.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <time dateTime={newsItem.publishedAt}>
                    {new Date(newsItem.publishedAt).toLocaleDateString(
                      "th-TH",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </time>
                </div>
              )}
            </div>

            {/* Tags */}
            {newsItem.tags && newsItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {newsItem.tags.map((tag: string, index: number) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {(newsItem.fullDescription || newsItem.description) && (
              <div className="prose prose-slate max-w-none mb-8">
                <p className="text-slate-700 leading-relaxed text-lg">
                  {newsItem.fullDescription || newsItem.description}
                </p>
              </div>
            )}

            {/* YouTube Video */}
            {newsItem.videoId && (
              <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${newsItem.videoId}`}
                  title={newsItem.title}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
