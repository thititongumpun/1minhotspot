export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 100); // Limit length
}

export function findNewsBySlug(news: any[], slug: string) {
  return news.find(item => {
    const itemSlug = createSlug(item.englishTitle || item.title || '');
    return itemSlug === slug;
  });
}