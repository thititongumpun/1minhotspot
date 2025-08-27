'use client'

import { useState, useEffect } from 'react'
import { NewsItem } from '@/types/NewsItem'
import { fetchYouTubeNewsWithStats } from '@/lib/youtube-service'

interface UseNewsReturn {
  newsData: NewsItem[]
  loading: boolean
  error: string | null
  fetchNews: () => void
  refetch: () => void
}

export function useNews(): UseNewsReturn {
  const [newsData, setNewsData] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 Fetching news data...')
      console.log('📡 Making YouTube API calls...')

      const youtubeNewsData = await fetchYouTubeNewsWithStats(process.env.NEXT_PUBLIC_YOUTUBE_APIKEY!);
      console.log(`✅ Received ${youtubeNewsData.length} videos from YouTube API`)

      setNewsData(youtubeNewsData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load news data'
      console.error('❌ Error in fetchNews:', errorMessage)
      setError(errorMessage)
    } finally {
      // Add small delay for better UX (show loading state briefly)
      setTimeout(() => {
        setLoading(false)
      }, 300)
    }
  }

  const refetch = () => {
    console.log('🔄 Force refreshing all data...')
    fetchNews()
  }

  useEffect(() => {
    console.log('🚀 useNews hook initialized')
    fetchNews()
  }, []) // Only run on mount

  return {
    newsData,
    loading,
    error,
    fetchNews,
    refetch,
  }
}