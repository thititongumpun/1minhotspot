
import { useEffect, useRef } from 'react';


export const useIntersectionObserver = (callback: () => void, dependencies: any[]) => {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, dependencies);

  return targetRef;
};