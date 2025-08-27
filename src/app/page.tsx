"use client";

import { useEffect, useState, useMemo } from "react";
import { TrendingUp, X } from "lucide-react";
import dynamic from "next/dynamic";
import LoadingState from "@/components/loading-state";
import ErrorState from "@/components/error-state";
import EmptyState from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { useNews } from "@/hooks/useNews";
import Link from "next/link";
import Image from "next/image";

const NewsGrid = dynamic(() => import("@/components/news-grid"), {
  ssr: false,
  loading: () => <LoadingState />,
});

const VideoModal = dynamic(() => import("@/components/video-modal"), {
  ssr: false,
});

export default function NewsPage() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const { newsData, loading, error, fetchNews, refetch } = useNews();

  // Extract all unique tags from news data
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    newsData.forEach((news) => {
      if (news.tags) {
        news.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [newsData]);

  // Filter news based on selected tags
  const filteredNews = useMemo(() => {
    if (selectedTags.length === 0) return newsData;
    return newsData.filter(
      (news) =>
        news.tags &&
        selectedTags.some((selectedTag) => news.tags!.includes(selectedTag))
    );
  }, [newsData, selectedTags]);

  // Tag color function (same as NewsCard)
  const getTagColor = (tag: string, index: number) => {
    const colors = [
      "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
      "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
      "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
      "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
      "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
      "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100",
      "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100",
      "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100",
      "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
      "bg-lime-50 text-lime-600 border-lime-200 hover:bg-lime-100",
    ];

    const specialColors = {
      Breaking: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
      News: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
      ข่าว: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
      AI: "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100",
      Hollywood:
        "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
      Kpop: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
      Shorts:
        "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
    };

    return (
      specialColors[tag as keyof typeof specialColors] ||
      colors[index % colors.length]
    );
  };

  // Fix hydration error by ensuring client-side rendering for date
  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlayVideo = (videoId: string) => {
    setSelectedVideo(videoId);
  };

  const handleCloseVideo = () => {
    setSelectedVideo(null);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleClearTags = () => {
    setSelectedTags([]);
  };

  const handleRefresh = () => {
    fetchNews();
    setSelectedTags([]);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-40 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="bg-gradient-to-r from-slate-900 to-slate-600 p-2 rounded-lg"
                    aria-hidden="true"
                  >
                    <Image
                      src="/logobro.png"
                      alt="1minhotspot"
                      width={40}
                      height={40}
                      priority
                      sizes="40px"
                    />
                  </div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                    สรุปข่าวร้อนใน 1 นาที
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  {/* Refresh Button */}
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-full transition-all duration-200"
                    aria-label="Refresh news"
                  >
                    <svg
                      className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {loading ? "อัพเดท..." : "รีเฟรช"}
                  </button>

                  {/* YouTube Channel Link */}
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-full">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <Link
                      href="https://www.youtube.com/@1minhotspot"
                      target="_blank"
                      className="hover:underline"
                    >
                      ช่อง YouTube
                    </Link>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="max-w-4xl">
                <h2 className="text-slate-600 text-lg font-medium leading-relaxed">
                  เสิร์ฟข่าวเด่น ข่าวกีฬา และเรื่องร้อนประจำวันในเวลาไม่เกิน 1
                  นาที! ติดตามทุกประเด็นสำคัญแบบไว รู้ทันโลก ไม่พลาดทุกกระแส
                  เหมาะสำหรับคนไม่มีเวลา แต่อยากรู้ครบ จบไว อัปเดตใหม่ทุกวัน
                </h2>
                <div className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    ข่าวล่าสุด
                  </span>
                  {mounted && (
                    <>
                      <span>•</span>
                      <time dateTime={new Date().toISOString()}>
                        อัพเดท{" "}
                        {new Date().toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        })}
                      </time>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Content States */}
          {loading && <LoadingState />}

          {error && !loading && <ErrorState error={error} onRetry={refetch} />}

          {!loading && !error && newsData.length === 0 && (
            <EmptyState onViewAll={handleRefresh} />
          )}

          {!loading && !error && newsData.length > 0 && (
            <>
              {/* News Grid Section */}
              <section aria-labelledby="news-section" className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-slate-600" />
                    ข่าวทั้งหมด
                  </h2>
                  <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {selectedTags.length > 0
                      ? filteredNews.length
                      : newsData.length}{" "}
                    ข่าว
                  </div>
                </div>

                {/* Tags Filter Section */}
                {allTags.length > 0 && (
                  <div className="mb-8 bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-slate-700">
                        กรองตามแท็ก
                      </h3>
                      {selectedTags.length > 0 && (
                        <button
                          onClick={handleClearTags}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                          ล้างทั้งหมด
                        </button>
                      )}
                    </div>

                    {/* Selected Tags */}
                    {selectedTags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-600 mb-2">
                          แท็กที่เลือก:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTags.map((tag, index) => (
                            <Badge
                              key={`selected-${tag}`}
                              onClick={() => handleTagClick(tag)}
                              className={`${getTagColor(
                                tag,
                                index
                              )} border cursor-pointer hover:scale-105 transition-all duration-200 ring-2 ring-offset-1 ring-slate-400`}
                            >
                              {tag}
                              <X className="w-3 h-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Available Tags */}
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {allTags.map((tag, index) => (
                        <Badge
                          key={`all-${tag}`}
                          onClick={() => handleTagClick(tag)}
                          className={`${getTagColor(
                            tag,
                            index
                          )} border cursor-pointer hover:scale-105 transition-all duration-200 ${
                            selectedTags.includes(tag) ? "opacity-50" : ""
                          }`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                      คลิกแท็กเพื่อกรองข่าว • แสดงทั้งหมด {allTags.length} แท็ก
                    </p>
                  </div>
                )}

                <NewsGrid news={filteredNews} onPlayVideo={handlePlayVideo} />
              </section>

              {/* Stats Section */}
              <div className="text-center" role="status" aria-live="polite">
                <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border shadow-sm">
                  <TrendingUp className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-600">
                    {selectedTags.length > 0 ? (
                      <>
                        แสดงข่าวที่กรอง {filteredNews.length} จากทั้งหมด{" "}
                        {newsData.length} ข่าว
                      </>
                    ) : (
                      <>แสดงข่าวทั้งหมด {newsData.length} ข่าว</>
                    )}
                  </span>
                </div>
              </div>
            </>
          )}
        </main>

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
                © {new Date().getFullYear()} สรุปข่าวร้อนใน 1 นาที. รับข่าวสารอย่างรวดเร็วในเวลาเพียงหนึ่งนาที
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Video Modal */}
      <VideoModal videoId={selectedVideo} onClose={handleCloseVideo} />
    </>
  );
}
