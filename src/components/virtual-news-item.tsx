import { CSSProperties } from "react";
import Image from "next/image";
import { TrendingUp } from "lucide-react";
import { Badge } from "./ui/badge";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import { VirtualItemData } from "@/types/NewsItem";

export type VirtualNewsItemProps = {
  index: number;
  style: CSSProperties;
  data: any;
};

// Virtual List Item Component with TypeScript
export const VirtualNewsItem: React.FC<
  ListChildComponentProps<VirtualItemData>
> = ({ index, style, data }) => {
  const { news, onPlayVideo, getTagColor } = data;
  const item = news[index];

  // Loading skeleton for items that haven't loaded yet
  if (!item) {
    return (
      <div style={style} className="p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 animate-pulse">
          <div className="h-48 bg-slate-200 rounded-t-lg"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-slate-200 rounded w-16"></div>
              <div className="h-6 bg-slate-200 rounded w-20"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className="p-2">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-slate-100">
          {item.thumbnail ? (
            <Image
              src={item.thumbnail}
              alt={item.title}
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

          {/* Play button overlay */}
          {item.videoId && (
            <button
              onClick={() => onPlayVideo(item.videoId!)}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors duration-200 group"
              aria-label={`Play video: ${item.title}`}
              type="button"
            >
              <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <svg
                  className="w-8 h-8 text-slate-800 ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}

          {/* Duration badge */}
          {item.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {item.duration}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 leading-tight text-sm md:text-base">
            {item.title}
          </h3>

          {item.description && (
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags.slice(0, 3).map((tag, tagIndex) => (
                <Badge
                  key={`${item.id}-${tag}`}
                  className={`${getTagColor(tag, tagIndex)} text-xs border`}
                >
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge className="text-xs bg-slate-100 text-slate-600 border">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {item.publishedAt && (
                <time dateTime={item.publishedAt}>
                  {new Date(item.publishedAt).toLocaleDateString("th-TH")}
                </time>
              )}
              {item.views && (
                <>
                  <span>•</span>
                  <span>{item.views.toLocaleString()} ครั้ง</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
