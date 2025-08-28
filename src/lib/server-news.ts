import { fetchNocodbData } from '@/lib/nocodb-service';
import { NewsItem } from '@/types/NewsItem';

export async function getNewsData(): Promise<{ news: NewsItem[], lastUpdated: string }> {
  try {
    const youtubeNewsData = await fetchNocodbData(process.env.NEXT_PUBLIC_NOCODB_APIKEY!);
    return {
      news: youtubeNewsData,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching news data:', error);
    return {
      news: [],
      lastUpdated: new Date().toISOString()
    };
  }
}