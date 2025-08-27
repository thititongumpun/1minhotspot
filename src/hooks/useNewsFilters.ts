// hooks/useNewsFilters.ts
import { useMemo, useState, useCallback } from 'react';
import type { NewsItem, UseNewsFiltersReturn } from '@/types/NewsItem';

export const useNewsFilters = (allNews: NewsItem[]): UseNewsFiltersReturn => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract all unique tags from news data
  const allTags = useMemo<string[]>(() => {
    const tagSet = new Set<string>();
    allNews.forEach((news) => {
      if (news.tags) {
        news.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [allNews]);

  // Filter news based on selected tags
  const filteredNews = useMemo<NewsItem[]>(() => {
    if (selectedTags.length === 0) return allNews;
    return allNews.filter(
      (news) =>
        news.tags &&
        selectedTags.some((selectedTag) => news.tags!.includes(selectedTag))
    );
  }, [allNews, selectedTags]);

  const handleTagClick = useCallback((tag: string): void => {
    setSelectedTags((prev) => {
      return prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag];
    });
  }, []);

  const handleClearTags = useCallback((): void => {
    setSelectedTags([]);
  }, []);

  const handleSearch = useCallback((query: string): void => {
    // Implementation for search functionality
    console.log('Search query:', query);
  }, []);

  return {
    filteredNews,
    selectedTags,
    allTags,
    handleTagClick,
    handleClearTags,
    handleSearch,
  };
};