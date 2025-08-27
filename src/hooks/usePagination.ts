// hooks/usePagination.ts
import { useState, useCallback } from 'react';
import type { PaginationState } from '@/types/NewsItem';

interface UsePaginationOptions {
  itemsPerPage?: number;
  totalItems: number;
}

interface UsePaginationReturn extends PaginationState {
  nextPage: () => void;
  resetPagination: () => void;
  setLoadingMore: (loading: boolean) => void;
}

export const usePagination = ({
  itemsPerPage = 20,
  totalItems,
}: UsePaginationOptions): UsePaginationReturn => {
  const [page, setPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const currentItemCount = page * itemsPerPage;
  const hasNextPage = currentItemCount < totalItems;

  const nextPage = useCallback((): void => {
    if (hasNextPage && !isLoadingMore) {
      setPage(prev => prev + 1);
    }
  }, [hasNextPage, isLoadingMore]);

  const resetPagination = useCallback((): void => {
    setPage(1);
    setIsLoadingMore(false);
  }, []);

  const setLoadingMore = useCallback((loading: boolean): void => {
    setIsLoadingMore(loading);
  }, []);

  return {
    page,
    hasNextPage,
    isLoadingMore,
    itemsPerPage,
    nextPage,
    resetPagination,
    setLoadingMore,
  };
};