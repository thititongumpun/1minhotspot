export function createSlug(text: string): string {
  if (!text || text.trim() === '') {
    return 'news-item';
  }
  
  // Simple Thai to English transliteration
  const thaiToEng: { [key: string]: string } = {
    'ก': 'k', 'ข': 'kh', 'ค': 'kh', 'ง': 'ng', 'จ': 'j', 'ฉ': 'ch', 'ช': 'ch', 'ซ': 's',
    'ด': 'd', 'ต': 't', 'ถ': 'th', 'ท': 'th', 'น': 'n', 'บ': 'b', 'ป': 'p', 'ผ': 'ph',
    'พ': 'ph', 'ฟ': 'f', 'ม': 'm', 'ย': 'y', 'ร': 'r', 'ล': 'l', 'ว': 'w', 'ศ': 's',
    'ส': 's', 'ห': 'h', 'อ': 'o', 'ฮ': 'h', 'ะ': 'a', 'า': 'a', 'ิ': 'i', 'ี': 'i',
    'ุ': 'u', 'ู': 'u', 'เ': 'e', 'แ': 'ae', 'โ': 'o', 'ใ': 'ai', 'ไ': 'ai'
  };
  
  let slug = text.toLowerCase();
  
  // Replace Thai characters
  for (const [thai, eng] of Object.entries(thaiToEng)) {
    slug = slug.replace(new RegExp(thai, 'g'), eng);
  }
  
  slug = slug
    .replace(/[^a-z0-9\s-]/g, '') // Remove remaining special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .trim()
    .substring(0, 100); // Limit length
    
  return slug || 'news-item';
}

export function findNewsBySlug(news: any[], slug: string) {
  return news.find(item => {
    const itemSlug = createSlug(item.englishTitle || item.title || '');
    return itemSlug === slug;
  });
}