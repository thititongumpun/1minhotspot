export interface NewsItem {
  id: string
  title: string
  category: string
  videoId: string
  thumbnail: string
  tags: string[]
  duration: string
  views: string
  publishedAt: string
  description: string
}

export interface ApiResponse {
  success: boolean
  data: NewsItem[]
  total: number
}

export type Category = 'All' | 'Sports' | 'Politics' | 'Entertainment' | 'Life'