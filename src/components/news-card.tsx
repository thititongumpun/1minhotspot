import React from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewsItem } from "@/types/NewsItem";
import { createSlug } from "@/lib/url-utils";

interface NewsCardProps {
  item: NewsItem;
  onPlayVideo: (videoId: string) => void;
  getTagColor: (tag: string, index: number) => string;
  style?: React.CSSProperties;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  item,
  onPlayVideo,
  getTagColor,
  style,
}) => {
  return (
    <div style={style} className="p-2">
      <Card className="h-full flex flex-col hover:shadow-md transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-slate-100 flex-shrink-0">
          {item.thumbnail ? (
            <Image
              src={item.thumbnail || "https://example.com/external-image.jpg"}
              alt={item.title || "https://example.com/external-image.jpg"}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <TrendingUp className="w-12 h-12 text-slate-400" />
            </div>
          )}

          {/* Play button */}
          {item.videoId && (
            <Button
              onClick={() => onPlayVideo(item.videoId!)}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors duration-200 group h-full w-full rounded-none p-0"
              variant="ghost"
              aria-label={`Play video: ${item.title}`}
            >
              <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <svg
                  className="w-8 h-8 text-slate-800 ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </Button>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 leading-tight text-sm">
            {item.title}
          </h3>

          {item.description && (
            <p className="text-xs text-slate-600 mb-3 line-clamp-2 flex-1">
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags
                .slice()
                .reverse()
                .slice(0, 5)
                .map((tag, tagIndex) => (
                  <Badge
                    key={`${item.id}-${tag}`}
                    className={`${getTagColor(tag, tagIndex)} text-xs border`}
                  >
                    {tag}
                  </Badge>
                ))}
              {item.tags.length > 2 && (
                <Badge className="text-xs bg-slate-100 text-slate-600 border">
                  +{item.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-slate-500 mt-auto">
            <div className="flex items-center gap-2">
              {item.publishedAt && (
                <time dateTime={item.publishedAt}>
                  {new Date(item.publishedAt).toLocaleDateString("th-TH")}
                </time>
              )}
            </div>
            <Link
              href={`/news/${createSlug(item.englishTitle || item.title || '')}`}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              ดูเพิ่มเติม
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
