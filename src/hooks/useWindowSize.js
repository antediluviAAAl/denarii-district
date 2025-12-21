import { useState, useEffect } from "react";

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let timeoutId = null;

    function handleResize() {
      // Clear the existing timer
      if (timeoutId) clearTimeout(timeoutId);

      // Set a new timer (Debounce ~150ms)
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    }

    window.addEventListener("resize", handleResize);

    // Initial calculation
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
}
