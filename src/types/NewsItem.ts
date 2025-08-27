export interface NewsItem {
  id: string
  title: string
  category: string
  videoId: string
  thumbnail: string
  tags: string[]
  duration: string
  views: string
  publishedAt: string
  description: string
}

export interface VirtualItemData {
  news: NewsItem[];
  onPlayVideo: (videoId: string) => void;
  getTagColor: (tag: string, index: number) => string;
}

export interface TagColors {
  [key: string]: string;
}

export interface UseNewsReturn {
  newsData: NewsItem[];
  loading: boolean;
  error: string | null;
  fetchNews: () => void;
  refetch: () => void;
}

export interface PaginationState {
  page: number;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  itemsPerPage: number;
}

export interface FilterState {
  selectedTags: string[];
  searchQuery?: string;
}

// Component Props Types
export interface NewsPageProps {
  initialData?: NewsItem[];
  className?: string;
}

export interface VirtualNewsItemProps {
  index: number;
  style: React.CSSProperties;
  data: VirtualItemData;
}

export interface VideoModalProps {
  videoId: string | null;
  onClose: () => void;
  isOpen?: boolean;
}

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export interface ErrorStateProps {
  error: string | Error;
  onRetry: () => void;
  className?: string;
}

export interface EmptyStateProps {
  onViewAll: () => void;
  message?: string;
  className?: string;
}

// Hook Types
export interface UseVirtualScrollReturn {
  listRef: React.RefObject<any>;
  itemCount: number;
  loadMoreItems: () => Promise<void>;
  isItemLoaded: (index: number) => boolean;
  resetScroll: () => void;
}

export interface UseNewsFiltersReturn {
  filteredNews: NewsItem[];
  selectedTags: string[];
  allTags: string[];
  handleTagClick: (tag: string) => void;
  handleClearTags: () => void;
  handleSearch: (query: string) => void;
}

// Constants
export const VIRTUAL_SCROLL_CONFIG = {
  ITEMS_PER_PAGE: 20,
  LIST_HEIGHT: 800,
  ITEM_HEIGHT: 350,
  OVERSCAN_COUNT: 3,
  THRESHOLD: 5,
} as const;

export const TAG_COLORS = {
  SPECIAL: {
    Breaking: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
    News: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    ข่าว: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    AI: "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100",
    Hollywood: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
    Kpop: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
    Shorts: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
  },
  DEFAULT: [
    "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
    "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
    "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
    "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
    "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100",
    "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100",
    "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100",
    "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
    "bg-lime-50 text-lime-600 border-lime-200 hover:bg-lime-100",
  ],
} as const;

// API Types
export interface NewsAPIResponse {
  items: NewsItem[];
  nextPageToken?: string;
  totalResults: number;
  hasMore: boolean;
}

export interface NewsAPIError {
  message: string;
  code: string;
  details?: any;
}

// Utility Types
export type NewsItemWithRequired<K extends keyof NewsItem> = NewsItem & Required<Pick<NewsItem, K>>;
export type NewsItemPartial = Partial<NewsItem> & Pick<NewsItem, 'id' | 'title'>;
export type TagClickHandler = (tag: string) => void;
export type VideoPlayHandler = (videoId: string) => void;