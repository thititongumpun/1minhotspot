import { NewsItem } from "@/types/NewsItem";
import { useState, useRef, useEffect } from "react";

export // Custom hook for main page scroll with virtual rendering
  const useMainScrollVirtualization = (
    items: NewsItem[],
    columnCount: number,
    rowHeight: number
  ) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleScroll = () => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Calculate which items should be visible
        const scrollTop = Math.max(0, -rect.top);
        const scrollBottom = scrollTop + viewportHeight;

        // Calculate visible row range with buffer
        const itemsPerRow = columnCount;
        const startRow = Math.floor(scrollTop / rowHeight);
        const endRow = Math.ceil(scrollBottom / rowHeight);

        // Add buffer rows for smooth scrolling
        const bufferRows = 2;
        const bufferedStartRow = Math.max(0, startRow - bufferRows);
        const bufferedEndRow = Math.min(
          Math.ceil(items.length / itemsPerRow),
          endRow + bufferRows
        );

        const start = bufferedStartRow * itemsPerRow;
        const end = Math.min(bufferedEndRow * itemsPerRow, items.length);

        setVisibleRange({ start, end });
      };

      const throttledHandleScroll = () => {
        requestAnimationFrame(handleScroll);
      };

      window.addEventListener("scroll", throttledHandleScroll);
      window.addEventListener("resize", throttledHandleScroll);

      // Initial calculation
      handleScroll();

      return () => {
        window.removeEventListener("scroll", throttledHandleScroll);
        window.removeEventListener("resize", throttledHandleScroll);
      };
    }, [items.length, columnCount, rowHeight]);

    return { visibleRange, containerRef };
  };