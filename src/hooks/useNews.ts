'use client'

import { useState, useEffect } from 'react'
import { NewsItem } from '@/types/NewsItem'
import { fetchNocodbData } from '@/lib/nocodb-service'

interface UseNewsReturn {
  newsData: NewsItem[]
  loading: boolean
  error: string | null
  fetchNews: () => void
  refetch: () => void
}

const CACHE_KEY = 'youtube_news_cache'
const CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 hours

export function useNews(): UseNewsReturn {
  const [newsData, setNewsData] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        const isValid = Date.now() - timestamp < CACHE_DURATION
        
        if (isValid) {
          console.log('📦 Using cached data')
          setNewsData(data)
          setLoading(false)
          return
        }
      }

      console.log('🔄 Fetching fresh data...')
      console.log('📡 Making YouTube API calls...')

      const youtubeNewsData = await fetchNocodbData(process.env.NEXT_PUBLIC_NOCODB_APIKEY!);
      console.log(`✅ Received ${youtubeNewsData.length} videos from YouTube API`)

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: youtubeNewsData,
        timestamp: Date.now()
      }))

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
    localStorage.removeItem(CACHE_KEY)
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