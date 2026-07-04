import { useState, useEffect, useCallback } from 'react';
import { LayoutMode } from '@/components/room/layout-toggle';

type ScreenSize = 'small' | 'medium' | 'large';

interface UseLayoutManagerReturn {
  layoutMode: LayoutMode;
  screenSize: ScreenSize;
  setLayoutMode: (mode: LayoutMode) => void;
  isLayoutMenuOpen: boolean;
  setIsLayoutMenuOpen: (open: boolean) => void;
}

const LAYOUT_STORAGE_KEY = 'meetlite-layout-preference';

export const useLayoutManager = (): UseLayoutManagerReturn => {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>('grid');
  const [screenSize, setScreenSize] = useState<ScreenSize>('medium');
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

  // Load saved layout preference
  useEffect(() => {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY) as LayoutMode;
    if (
      savedLayout &&
      ['grid', 'speaker', 'presentation'].includes(savedLayout)
    ) {
      setLayoutModeState(savedLayout);
    }
  }, []);

  // Save layout preference
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
  }, []);

  // Screen size detection
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('small');
      } else if (width < 1280) {
        setScreenSize('medium');
      } else {
        setScreenSize('large');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return {
    layoutMode,
    screenSize,
    setLayoutMode,
    isLayoutMenuOpen,
    setIsLayoutMenuOpen,
  };
};
