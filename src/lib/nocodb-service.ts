import { NewsItem } from '@/types/NewsItem'

// Your API configuration
const TABLE_ID = 'mxrdn7f2fl7g3yq'
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

    // Fetch records from NocoDB table with sorting
    const response = await fetch(
      `${API_BASE_URL}/api/v2/tables/${TABLE_ID}/records?sort=-Id&limit=50`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error(`NocoDB API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform NocoDB records to NewsItem format
    return data.list?.map((record: any) => ({
      id: `nocodb-${record.Id}`,
      title: record.thTitle || record.title || '',
      englishTitle: record.title || '', // English title for URLs
      videoId: extractVideoId(record.url || ''),
      thumbnail: record.imageUrl || '',
      duration: '0:30', // Default for shorts, or you can add a duration field to your table
      publishedAt: record.pubDate ? new Date(record.pubDate).toISOString().split('T')[0] : '',
      description: record.thDesc ?
        (record.thDesc.slice(0, 150) + (record.thDesc.length > 150 ? '...' : '')) :
        (record.title ? record.title.slice(0, 150) + (record.title.length > 150 ? '...' : '') : ''),
      fullDescription: record.thDesc || record.title || '',
      tags: parseHashtagsFromJson(record.hashtag || '[]')
    })) || [];

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
