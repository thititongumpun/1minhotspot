import { fetchNocodbData } from '@/lib/nocodb-service';
import { NewsItem } from '@/types/NewsItem';

export async function getNewsData(): Promise<{ news: NewsItem[], lastUpdated: string }> {
  try {
    const youtubeNewsData = await fetchNocodbData(process.env.NEXT_PUBLIC_NOCODB_APIKEY!);
    const thailandTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString();
    return {
      news: youtubeNewsData,
      lastUpdated: thailandTime
    };
  } catch (error) {
    console.error('Error fetching news data:', error);
    const thailandTime = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString();
    return {
      news: [],
      lastUpdated: thailandTime
    };
  }
}