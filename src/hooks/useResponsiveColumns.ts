import { useState, useEffect } from "react";

export const useResponsiveColumns = () => {
  const [columnCount, setColumnCount] = useState(1); // Start with mobile-first
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setColumnCount(1);
      } else if (width < 1024) {
        setColumnCount(2);
      } else if (width < 1440) {
        setColumnCount(3);
      } else {
        setColumnCount(4);
      }
    };

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  // Return 1 column until mounted to prevent hydration mismatch
  return mounted ? columnCount : 1;
};
