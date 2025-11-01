import { useState, useEffect } from 'react';

/**
 * Custom hook for media query matching
 * Returns true if the media query matches, false otherwise
 *
 * @param query - Media query string (e.g., '(min-width: 1024px)')
 * @returns boolean indicating if the media query matches
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Handler for change events
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers support addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Hook to detect desktop screens (≥ 1024px)
 */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/**
 * Hook to detect tablet screens (768px - 1023px)
 */
export const useIsTablet = () =>
  useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

/**
 * Hook to detect mobile screens (< 768px)
 */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

/**
 * Hook to detect large screens (≥ 1280px)
 */
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1280px)');

export default useMediaQuery;
