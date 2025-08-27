'use client'

import NewsCard from './news-card'
import { NewsItem } from '@/types/NewsItem'

interface NewsGridProps {
  news: NewsItem[]
  onPlayVideo: (videoId: string) => void
}

export default function NewsGrid({ news, onPlayVideo }: NewsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {news.map((newsItem) => (
        <NewsCard
          key={newsItem.id}
          news={newsItem}
          onPlay={onPlayVideo}
        />
      ))}
    </div>
  )
}