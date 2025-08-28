import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: 'https://1minhotspot.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    }
  ]
}