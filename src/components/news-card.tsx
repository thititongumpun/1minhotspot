"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, Calendar, Tag } from "lucide-react";
import { NewsItem } from "@/types/NewsItem";

interface NewsCardProps {
  news: NewsItem & { tags?: string[] };
  onPlay: (videoId: string) => void;
}

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

  // Special colors for specific tags
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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function NewsCard({ news, onPlay }: NewsCardProps) {
  return (
    <Card
      className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-white/80 backdrop-blur-sm border-0 shadow-lg overflow-hidden"
      onClick={() => onPlay(news.videoId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay(news.videoId);
        }
      }}
      aria-label={`Watch ${news.title}`}
    >
      <CardHeader className="p-0">
        <div className="relative overflow-hidden">
          <img
            src={news.thumbnail}
            alt={news.title}
            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://img.youtube.com/vi/${news.videoId}/maxresdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Duration Badge */}
          <div className="absolute bottom-2 right-2 bg-black/90 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
            <Clock className="w-3 h-3 inline mr-1" />
            {news.duration}
          </div>

          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="bg-white/95 backdrop-blur-sm rounded-full p-4 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <svg
                className="w-8 h-8 text-slate-900"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-base font-semibold mb-2 line-clamp-2 group-hover:text-slate-600 transition-colors leading-tight">
          {news.title}
        </CardTitle>
        <p className="text-sm text-slate-600 mb-2 line-clamp-2 leading-relaxed">
          {news.description}
        </p>

        {/* Dynamic Tags Section - Fixed Height */}
        <div className="mb-2 h-12 overflow-hidden">
          {news.tags && news.tags.length > 0 ? (
            <div className="flex items-start gap-1">
              <Tag className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {news.tags
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map(
                    (
                      tag,
                      index // Reduced to 5 tags to make room for +X
                    ) => (
                      <Badge
                        key={`${tag}-${index}`}
                        className={`${getTagColor(
                          tag,
                          index
                        )} border text-xs px-2 py-0.5 font-medium transition-all duration-200 hover:scale-105`}
                        style={{ fontSize: "0.65rem" }} // Smaller text for tags
                      >
                        {tag}
                      </Badge>
                    )
                  )}
                {news.tags.length > 5 && (
                  <Badge className="bg-slate-50 text-slate-500 border-slate-200 text-xs px-2 py-0.5">
                    +{news.tags.length - 5}
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full"></div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div
            className="flex items-center gap-1 flex-1"
            title={`${news.views} views`}
          >
            <Eye className="w-3 h-3" />
            <span>{news.views}</span>
          </div>
          <div
            className="flex items-center gap-1 flex-1 justify-end"
            title={`Published on ${formatDate(news.publishedAt)}`}
          >
            <Calendar className="w-3 h-3" />
            <span>{formatDate(news.publishedAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
