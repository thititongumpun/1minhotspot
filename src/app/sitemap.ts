import type { MetadataRoute } from 'next'
import { getNewsData } from '@/lib/server-news'
import { createSlug } from '@/lib/url-utils'

export const revalidate = 3600; // Revalidate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { news, lastUpdated } = await getNewsData()
  
  const newsUrls = news.map((item) => ({
    url: `https://1minhotspot.vercel.app/news/${createSlug(item.englishTitle || item.title || '')}`,
    lastModified: new Date(item.publishedAt || lastUpdated),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://1minhotspot.vercel.app',
      lastModified: new Date(lastUpdated),
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...newsUrls,
  ]
}