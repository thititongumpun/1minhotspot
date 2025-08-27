import { NewsItem } from '@/types/NewsItem'

// Your API configuration
const CHANNEL_ID = 'UCWlgsBnxgTy6D5xNz2D06Fw'
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3'

// Advanced approach - Get real view counts and duration (requires 2 API calls)
export const fetchYouTubeNewsWithStats = async (apiKey: string): Promise<NewsItem[]> => {
  try {
    // Step 1: Get video IDs from search
    const searchUrl = new URL(`${API_BASE_URL}/search`)
    searchUrl.searchParams.append('key', apiKey)
    searchUrl.searchParams.append('channelId', CHANNEL_ID)
    searchUrl.searchParams.append('part', 'id')
    searchUrl.searchParams.append('order', 'date')
    searchUrl.searchParams.append('maxResults', '50')
    searchUrl.searchParams.append('type', 'video')
    searchUrl.searchParams.append('videoDuration', 'short')
    searchUrl.searchParams.append('videoDefinition', 'high')

    const searchResponse = await fetch(searchUrl.toString())
    if (!searchResponse.ok) throw new Error(`Search API error: ${searchResponse.status}`)

    const searchData = await searchResponse.json()
    const videoIds = searchData.items.map((item: any) => item.id.videoId)

    if (videoIds.length === 0) return []

    // Step 2: Get detailed video information
    const videosUrl = new URL(`${API_BASE_URL}/videos`)
    videosUrl.searchParams.append('key', apiKey)
    videosUrl.searchParams.append('id', videoIds.join(','))
    videosUrl.searchParams.append('part', 'snippet,statistics,contentDetails')

    const videosResponse = await fetch(videosUrl.toString())
    if (!videosResponse.ok) throw new Error(`Videos API error: ${videosResponse.status}`)

    const videosData = await videosResponse.json()

    console.log(videosData);

    // Transform to NewsItem format with real stats and tags extracted from description
    return videosData.items.map((video: any) => ({
      id: `yt-${video.id}`,
      title: video.snippet.title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      videoId: video.id,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
      duration: formatDuration(video.contentDetails.duration), // Real duration
      views: formatViewCount(video.statistics.viewCount), // Real view count
      publishedAt: new Date(video.snippet.publishedAt).toISOString().split('T')[0],
      description: video.snippet.description.slice(0, 150) + (video.snippet.description.length > 150 ? '...' : ''),
      tags: extractHashtagsFromDescription(video.snippet.description) // Extract hashtags from description
    }))

  } catch (error) {
    console.error('Error fetching YouTube news with stats:', error)
    throw error
  }
}

// Extract hashtags from description text
const extractHashtagsFromDescription = (description: string): string[] => {
  if (!description) return [];

  // Match hashtags pattern: # followed by Thai/English characters, numbers, and underscores
  const hashtagPattern = /#([ก-๙a-zA-Z0-9_]+)/g;
  const hashtags: string[] = [];
  let match;

  while ((match = hashtagPattern.exec(description)) !== null) {
    const tag = match[1]; // Get the text after #
    if (!hashtags.includes(tag)) { // Avoid duplicates
      hashtags.push(tag);
    }
  }

  return hashtags;
};

// Utility functions
const formatDuration = (isoDuration: string): string => {
  const match = isoDuration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/)
  const minutes = parseInt(match?.[1] || '0')
  const seconds = parseInt(match?.[2] || '0')
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatViewCount = (viewCount: string): string => {
  const count = parseInt(viewCount)
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${Math.floor(count / 1000)}K`
  return count.toString()
}