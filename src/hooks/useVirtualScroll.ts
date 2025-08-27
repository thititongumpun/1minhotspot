// hooks/useVirtualScroll.ts
import { useCallback, useRef, useMemo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { NewsItem, VirtualItemData, UseVirtualScrollReturn } from '@/types/NewsItem';

interface UseVirtualScrollOptions {
  items: NewsItem[];
  itemsPerPage: number;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
}

export const useVirtualScroll = ({
  items,
  itemsPerPage,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
}: UseVirtualScrollOptions): UseVirtualScrollReturn => {
  const listRef = useRef<List<VirtualItemData> | null>(null);

  // Calculate item count including loading items
  const itemCount = useMemo(() => {
    return hasNextPage ? items.length + 1 : items.length;
  }, [items.length, hasNextPage]);

  // Load more items for infinite scroll
  const loadMoreItems = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !hasNextPage) return;
    await onLoadMore();
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Check if item is loaded
  const isItemLoaded = useCallback((index: number): boolean => {
    return !!items[index];
  }, [items]);

  // Reset scroll position
  const resetScroll = useCallback((): void => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, []);

  return {
    listRef,
    itemCount,
    loadMoreItems,
    isItemLoaded,
    resetScroll,
  };
};



