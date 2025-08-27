import { useCallback } from 'react';
import { TAG_COLORS } from '@/types/NewsItem';

export const useTagColors = () => {
  const getTagColor = useCallback((tag: string, index: number): string => {
    return TAG_COLORS.SPECIAL[tag as keyof typeof TAG_COLORS.SPECIAL] ||
      TAG_COLORS.DEFAULT[index % TAG_COLORS.DEFAULT.length];
  }, []);

  return { getTagColor };
};
