import { NewsItem } from '@/types/NewsItem'

// Your API configuration
const TABLE_ID = 'mxrdn7f2fl7g3yq'
const SANOOK_TABLE_ID = 'miuuutll9786ebb'
const API_BASE_URL = 'https://nocodb-proxy.thiti180536842.workers.dev'

// Fetch data from NocoDB
export const fetchNocodbData = async (apiKey: string): Promise<NewsItem[]> => {
  try {
    // Set up headers with the API token
    const headers = new Headers();
    headers.append("xc-token", apiKey);

    const requestOptions = {
      method: "GET",
      headers: headers,
      redirect: "follow" as RequestRedirect
    };

    // Fetch from both tables sorted by publishedAt
    const [response1, response2] = await Promise.all([
      fetch(`${API_BASE_URL}/api/v2/tables/${TABLE_ID}/records?sort=-pubDate,-Id&limit=25`, requestOptions),
      fetch(`${API_BASE_URL}/api/v2/tables/${SANOOK_TABLE_ID}/records?sort=-pubDate,-Id&limit=25`, requestOptions)
    ]);

    if (!response1.ok || !response2.ok) {
      throw new Error(`NocoDB API error: ${response1.status} or ${response2.status}`);
    }

    const [data1, data2] = await Promise.all([
      response1.json(),
      response2.json()
    ]);

    // Transform records from both tables
    const news1 = data1.list?.map((record: any) => ({
      id: `nocodb-${record.Id}`,
      title: record.thTitle || record.title || '',
      englishTitle: record.title || '',
      videoId: extractVideoId(record.url || ''),
      thumbnail: record.imageUrl || '',
      duration: '0:30',
      publishedAt: record.pubDate ? new Date(record.pubDate).toISOString().split('T')[0] : '',
      description: record.thDesc ?
        (record.thDesc.slice(0, 150) + (record.thDesc.length > 150 ? '...' : '')) :
        (record.title ? record.title.slice(0, 150) + (record.title.length > 150 ? '...' : '') : ''),
      fullDescription: record.thDesc || record.title || '',
      tags: parseHashtagsFromJson(record.hashtag || '[]')
    })) || [];

    const news2 = data2.list?.map((record: any) => ({
      id: `sanook-${record.Id}`,
      title: record.thTitle || record.title || '',
      englishTitle: record.thTitle || record.title || `sanook-${record.Id}`,
      videoId: extractVideoId(record.url || ''),
      thumbnail: record.imageUrl || '',
      duration: '0:30',
      publishedAt: record.pubDate ? new Date(record.pubDate).toISOString().split('T')[0] : '',
      description: record.thDesc ?
        (record.thDesc.slice(0, 150) + (record.thDesc.length > 150 ? '...' : '')) :
        (record.title ? record.title.slice(0, 150) + (record.title.length > 150 ? '...' : '') : ''),
      fullDescription: record.thDesc || record.title || '',
      tags: parseHashtagsFromJson(record.hashtag || '[]')
    })) || [];

    // Mix news from both sources in chronological order
    const mixedNews: NewsItem[] = [];
    let i = 0, j = 0;
    
    while (i < news1.length || j < news2.length) {
      const date1 = i < news1.length ? new Date(news1[i].publishedAt || '').getTime() : 0;
      const date2 = j < news2.length ? new Date(news2[j].publishedAt || '').getTime() : 0;
      
      if (i >= news1.length) {
        mixedNews.push(news2[j++]);
      } else if (j >= news2.length) {
        mixedNews.push(news1[i++]);
      } else if (date1 >= date2) {
        mixedNews.push(news1[i++]);
      } else {
        mixedNews.push(news2[j++]);
      }
    }

    return mixedNews;

  } catch (error) {
    console.error('Error fetching NocoDB data:', error);
    throw error;
  }
}


// Parse hashtags from JSON string format
const parseHashtagsFromJson = (hashtagJson: string): string[] => {
  if (!hashtagJson) return [];

  try {
    // The hashtag field appears to be a JSON array string like: {"#tag1","#tag2","#tag3"}
    // Convert PostgreSQL array format to proper JSON array
    const cleanJson = hashtagJson
      .replace(/^\{/, '[')  // Replace opening brace with bracket
      .replace(/\}$/, ']')  // Replace closing brace with bracket
      .replace(/"/g, '"');  // Ensure proper quotes

    const parsed = JSON.parse(cleanJson);

    // Remove the # symbol and return clean tags
    return Array.isArray(parsed)
      ? parsed.map(tag => typeof tag === 'string' ? tag.replace(/^#/, '') : tag)
      : [];
  } catch (error) {
    console.warn('Error parsing hashtags:', error);
    return [];
  }
};

// Extract YouTube video ID from URL
const extractVideoId = (url: string): string => {
  if (!url) return '';

  // Handle YouTube Shorts URLs: https://www.youtube.com/shorts/XJPKrXiTtn8
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) return shortsMatch[1];

  // Handle regular YouTube URLs
  const regularMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (regularMatch) return regularMatch[1];

  // Handle youtu.be URLs
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  return '';
};
