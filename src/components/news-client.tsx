"use client";

import { useState, useMemo, useCallback } from "react";
import { TrendingUp, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { NewsItem } from "@/types/NewsItem";
import { useMainScrollVirtualization } from "@/hooks/useMainScrollVirtualization";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";

const NewsCard = dynamic(
  () =>
    import("@/components/news-card").then((mod) => ({ default: mod.NewsCard })),
  {
    ssr: false,
    loading: () => (
      <div className="p-2 h-96 bg-slate-100 animate-pulse rounded-lg" />
    ),
  }
);

const VideoModal = dynamic(() => import("@/components/video-modal"), {
  ssr: false,
});

interface NewsClientProps {
  initialNews: NewsItem[];
}

export default function NewsClient({ initialNews }: NewsClientProps) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(12);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const columnCount = useResponsiveColumns();
  const ROW_HEIGHT = 480;

  // Extract all unique tags
  const allTags = useMemo<string[]>(() => {
    const tagSet = new Set<string>();
    initialNews.forEach((news) => {
      if (news.tags) {
        news.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [initialNews]);

  // Filter news based on selected tags
  const filteredNews = useMemo<NewsItem[]>(() => {
    if (selectedTags.length === 0) return initialNews;
    return initialNews.filter(
      (news) =>
        news.tags &&
        selectedTags.some((selectedTag) => news.tags!.includes(selectedTag))
    );
  }, [initialNews, selectedTags]);

  // Items to display (limited by displayCount)
  const displayedNews = useMemo<NewsItem[]>(() => {
    return filteredNews.slice(0, displayCount);
  }, [filteredNews, displayCount]);

  // Head news for carousel (first 6 items)
  const headNews = useMemo<NewsItem[]>(() => {
    return filteredNews.slice(0, 6);
  }, [filteredNews]);

  // Virtual scrolling hook
  const { visibleRange, containerRef } = useMainScrollVirtualization(
    displayedNews,
    columnCount,
    ROW_HEIGHT
  );

  // Get visible items
  const visibleItems = displayedNews.slice(
    visibleRange.start,
    visibleRange.end
  );

  const hasMore = displayCount < filteredNews.length;

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setDisplayCount((prev) => Math.min(prev + 20, filteredNews.length));
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, filteredNews.length]);

  const loadMoreRef = useIntersectionObserver(loadMore, [loadMore]);

  const totalRows = Math.ceil(displayedNews.length / columnCount);
  const totalHeight = totalRows * ROW_HEIGHT;

  const getTagColor = useCallback((tag: string, index: number): string => {
    const specialColors: { [key: string]: string } = {
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

    const defaultColors = [
      "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
      "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
      "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
      "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
      "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
    ];

    return specialColors[tag] || defaultColors[index % defaultColors.length];
  }, []);

  const handlePlayVideo = useCallback((videoId: string): void => {
    setSelectedVideo(videoId);
  }, []);

  const handleCloseVideo = useCallback((): void => {
    setSelectedVideo(null);
  }, []);

  const handleTagClick = useCallback((tag: string): void => {
    setSelectedTags((prev) => {
      const newTags = prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag];
      setDisplayCount(40);
      return newTags;
    });
  }, []);

  const handleClearTags = useCallback((): void => {
    setSelectedTags([]);
    setDisplayCount(40);
  }, []);

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-slate-600" />
              ข่าวทั้งหมด
            </h2>
            <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              แสดง {displayedNews.length} จาก {filteredNews.length} ข่าว
            </div>
          </div>

          {/* Tags Filter */}
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
                    type="button"
                  >
                    <X className="w-3 h-3" />
                    ล้างทั้งหมด
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag, index) => (
                  <Badge
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`${getTagColor(
                      tag,
                      index
                    )} border cursor-pointer hover:scale-105 transition-all duration-200 ${
                      selectedTags.includes(tag) ? "ring-2 ring-slate-400" : ""
                    }`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Mobile Carousel for Head News */}
          <div className="block md:hidden mb-6">
            <Carousel className="w-full">
              <CarouselContent className="-ml-2 md:-ml-4">
                {headNews.map((item) => (
                  <CarouselItem key={item.id} className="pl-2 md:pl-4 basis-4/5">
                    <div className="h-[500px]">
                      <NewsCard
                        item={item}
                        onPlayVideo={handlePlayVideo}
                        getTagColor={getTagColor}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          </div>

          {/* Virtual Grid Container */}
          <div
            ref={containerRef}
            className="bg-white/30 backdrop-blur-sm rounded-lg border border-slate-200/50 hidden md:block"
            style={{
              minHeight: totalHeight,
              position: "relative",
            }}
          >
            {visibleItems.length > 0 && (
              <div
                className={`grid gap-4 gap-y-6 p-4`}
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  position: "absolute",
                  top:
                    Math.floor(visibleRange.start / columnCount) * ROW_HEIGHT,
                  width: "100%",
                  minHeight:
                    Math.ceil(visibleItems.length / columnCount) * ROW_HEIGHT,
                }}
              >
                {visibleItems.map((item, index) => (
                  <div key={`${item.id}-${visibleRange.start + index}`} className="h-96">
                    <NewsCard
                      item={item}
                      onPlayVideo={handlePlayVideo}
                      getTagColor={getTagColor}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Grid (Simple grid for remaining items) */}
          <div className="block md:hidden">
            <div className="grid grid-cols-1 gap-4">
              {displayedNews.slice(6).map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onPlayVideo={handlePlayVideo}
                  getTagColor={getTagColor}
                />
              ))}
            </div>
          </div>

          {/* Load more trigger */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="h-20 flex items-center justify-center mt-8"
            >
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  กำลังโหลดเพิ่มเติม...
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors font-medium"
                >
                  โหลดเพิ่มเติม ({filteredNews.length - displayCount}{" "}
                  ข่าวที่เหลือ)
                </button>
              )}
            </div>
          )}
        </section>

        {/* Stats */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border shadow-sm">
            <TrendingUp className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">
              แสดงข่าว {displayedNews.length} จากทั้งหมด {initialNews.length}{" "}
              ข่าว
            </span>
          </div>
        </div>
      </main>

      <VideoModal videoId={selectedVideo} onClose={handleCloseVideo} />
    </>
  );
}
