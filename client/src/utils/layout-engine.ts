import { LayoutMode } from '@/components/room/layout-toggle';

export type ParticipantCount = 1 | 2 | 'small' | 'medium' | 'large';

export interface LayoutConfig {
  mode: LayoutMode;
  gridCols: number;
  gridRows: number;
  maxVisibleParticipants: number;
  aspectRatio: string;
  gap: string;
  padding: string;
  mainSpeakerSize: 'full' | 'large' | 'medium' | 'small';
  secondarySpeakerSize: 'large' | 'medium' | 'small' | 'thumbnail';
  showSelfView: boolean;
  selfViewSize: 'hidden' | 'small' | 'medium' | 'large';
  layoutType: 'single' | 'side-by-side' | 'grid' | 'auto-mode' | 'presentation';
  bandwidthOptimization: boolean;
  speakerPrioritization: boolean;
  scrollable: boolean;
  pinningEnabled: boolean;
  zoomScale: number; // Scale factor for zoom effect (1.0 = normal, 0.8 = zoomed out)
}

export interface LayoutEngineOptions {
  participantCount: number;
  screenSize: 'small' | 'medium' | 'large';
  isPresenting: boolean;
  hasActiveSpeaker: boolean;
  bandwidthMode: 'high' | 'medium' | 'low';
  userPreferences: {
    showSelfView: boolean;
    preferSpeakerView: boolean;
    autoSwitchLayout: boolean;
  };
}

/**
 * Advanced Layout Computation Engine
 * Handles all participant count scenarios from 1 to 250+ participants
 * Inspired by Google Meet's sophisticated layout system
 */
export class LayoutEngine {
  private static readonly LAYOUT_THRESHOLDS = {
    SINGLE_PARTICIPANT: 1,
    TWO_PARTICIPANTS: 2,
    SMALL_GROUP_MAX: 4, // 2-4 participants: 2x2 grid
    MEDIUM_GROUP_MAX: 9, // 5-9 participants: 3x3 grid
    LARGE_GROUP_MAX: 16, // 10-16 participants: 4x4 grid
    VERY_LARGE_MAX: 49, // 17-49 participants: up to 7x7 grid
    MASSIVE_MAX: 250, // 50+ participants: speaker view with thumbnails
  };

  // Additional constants for better code readability and maintainability
  private static readonly LAYOUT_CONSTANTS = {
    SELF_VIEW_THRESHOLD: 12, // Show self-view for meetings with 12 or fewer participants
    BANDWIDTH_OPTIMIZATION_THRESHOLD: 6, // Enable bandwidth optimization for 6+ participants
    THREE_PARTICIPANTS: 3, // Special case for 3 participants layout
    SIX_PARTICIPANTS: 6, // Threshold for self-view size and bandwidth optimization
    ZOOM_THRESHOLD: 2, // Apply zoom effect for participant counts > 2
  };

  // Zoom scale configurations for different participant counts
  private static readonly ZOOM_SCALES = {
    NORMAL: 1.0, // No zoom for 1-2 participants
    ZOOMED_OUT: 0.85, // Slight zoom out for 3-6 participants
    MORE_ZOOMED_OUT: 0.75, // More zoom out for 7+ participants
  };

  private static readonly SCREEN_CONFIGS = {
    small: {
      // Mobile <600px
      maxCols: 2,
      maxRows: 2,
      optimalParticipants: 4,
      aspectRatio: 'aspect-[16/9]',
      breakpoint: 600,
    },
    medium: {
      // Tablet 600-767px
      maxCols: 3,
      maxRows: 3,
      optimalParticipants: 9,
      aspectRatio: 'aspect-[16/9]',
      breakpoint: 768,
    },
    large: {
      // Laptop 768-1023px
      maxCols: 4,
      maxRows: 4,
      optimalParticipants: 16,
      aspectRatio: 'aspect-[16/9]',
      breakpoint: 1024,
    },
    xlarge: {
      // Desktop ≥1024px
      maxCols: 7,
      maxRows: 7,
      optimalParticipants: 49,
      aspectRatio: 'aspect-[16/9]',
      breakpoint: 1024,
    },
  };

  /**
   * Main layout computation function
   * Determines optimal layout configuration based on participant count and context
   * Implements dynamic grid computation with viewport-aware sizing
   */
  static computeLayout(options: LayoutEngineOptions): LayoutConfig {
    const { participantCount, isPresenting } = options;

    // Handle presentation mode first (overrides everything)
    if (isPresenting) {
      return this.computePresentationLayout(options);
    }

    // Handle single participant using threshold constant
    if (participantCount === this.LAYOUT_THRESHOLDS.SINGLE_PARTICIPANT) {
      return this.computeSingleParticipantLayout(options);
    }

    // Dynamic grid computation based on participant count thresholds
    return this.computeDynamicGridLayout(options);
  }

  /**
   * Single Participant Layout (1 person)
   * - Self-view centered filling most of the screen
   * - "You're the only one here" message
   * - Movable/minimizable self-view
   */
  private static computeSingleParticipantLayout(
    options: LayoutEngineOptions
  ): LayoutConfig {
    const { screenSize } = options;
    const screenConfig = this.SCREEN_CONFIGS[screenSize];

    return {
      mode: 'grid',
      gridCols: 1,
      gridRows: 1,
      maxVisibleParticipants: 1,
      aspectRatio: screenConfig.aspectRatio,
      gap: 'gap-0',
      padding: screenSize === 'small' ? 'p-4' : 'p-8',
      mainSpeakerSize: 'full',
      secondarySpeakerSize: 'small',
      showSelfView: true,
      selfViewSize: 'large',
      layoutType: 'single',
      bandwidthOptimization: false,
      speakerPrioritization: false,
      scrollable: false,
      pinningEnabled: false,
      zoomScale: this.ZOOM_SCALES.NORMAL, // No zoom for single participant
    };
  }

  /**
   * Presentation Layout
   * - Shared screen takes 65% of width (centered or aligned left)
   * - Participants appear in filmstrip (horizontal/vertical based on device)
   * - Desktop: vertical strip on right (35% width)
   * - Tablet: scrollable horizontal strip
   * - Mobile: small overlay strip or floating circular thumbnails
   * - Presenter's video can appear as floating thumbnail over presentation
   */
  private static computePresentationLayout(
    options: LayoutEngineOptions
  ): LayoutConfig {
    const { participantCount, screenSize } = options;
    const screenConfig = this.SCREEN_CONFIGS[screenSize];

    // Determine filmstrip layout based on screen size
    let gridCols: number;
    let gridRows: number;
    let maxVisibleParticipants: number;

    if (screenSize === 'small') {
      // Small screens: Mobile layout (participants below shared screen)
      // This is handled by MobileVideoLayout, not this function
      gridCols = 1;
      gridRows = 1;
      maxVisibleParticipants = 1;
    } else if (screenSize === 'medium') {
      // Medium screens: 1 column (vertical strip)
      gridCols = 1;
      gridRows = Math.min(participantCount, 6); // Show up to 6 participants
      maxVisibleParticipants = Math.min(participantCount, 6);
    } else {
      // Large screens: 2x2 grid (4 participants visible)
      gridCols = 2;
      gridRows = 2;
      maxVisibleParticipants = 4;
    }

    return {
      mode: 'presentation',
      gridCols,
      gridRows,
      maxVisibleParticipants,
      aspectRatio: screenConfig.aspectRatio,
      gap: 'gap-3', // Increased gap for better spacing
      padding: 'p-3', // Increased padding for better spacing
      mainSpeakerSize: 'full',
      secondarySpeakerSize: 'small',
      showSelfView: false,
      selfViewSize: 'hidden',
      layoutType: 'presentation',
      bandwidthOptimization: true,
      speakerPrioritization: false,
      scrollable: false, // No scrolling, use +X more indicator instead
      pinningEnabled: true,
      zoomScale: this.ZOOM_SCALES.NORMAL, // No zoom for presentation mode
    };
  }

  /**
   * Dynamic Grid Layout Computation
   * Implements viewport-aware sizing with equal space distribution
   * Based on participant count with centered layouts for uneven counts
   */
  private static computeDynamicGridLayout(
    options: LayoutEngineOptions
  ): LayoutConfig {
    const { participantCount, screenSize, hasActiveSpeaker } = options;

    // Calculate optimal grid dimensions based on participant count thresholds
    const gridDimensions =
      this.calculateOptimalGridDimensions(participantCount);

    // Determine layout type based on participant count thresholds
    let layoutType: 'side-by-side' | 'grid' | 'auto-mode';
    if (participantCount === this.LAYOUT_THRESHOLDS.TWO_PARTICIPANTS) {
      layoutType = 'side-by-side';
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.MEDIUM_GROUP_MAX) {
      layoutType = 'grid';
    } else {
      layoutType = 'auto-mode';
    }

    return {
      mode: hasActiveSpeaker ? 'speaker' : 'grid',
      gridCols: gridDimensions.cols,
      gridRows: gridDimensions.rows,
      maxVisibleParticipants: participantCount,
      aspectRatio: this.getAspectRatioForThreshold(participantCount), // Use threshold-based aspect ratio
      gap: 'gap-3', // Consistent gap for better spacing
      padding:
        participantCount <= this.LAYOUT_THRESHOLDS.SMALL_GROUP_MAX
          ? screenSize === 'small'
            ? 'px-2 py-0'
            : 'px-3 py-0' // Minimal padding for 2x2 layouts
          : screenSize === 'small'
          ? 'px-2 py-1'
          : 'px-3 py-2', // Normal padding for other layouts
      mainSpeakerSize: 'large',
      secondarySpeakerSize: 'medium',
      showSelfView:
        participantCount <= this.LAYOUT_CONSTANTS.SELF_VIEW_THRESHOLD,
      selfViewSize:
        participantCount <= this.LAYOUT_CONSTANTS.SIX_PARTICIPANTS
          ? 'small'
          : 'hidden',
      layoutType: layoutType,
      bandwidthOptimization:
        participantCount >
        this.LAYOUT_CONSTANTS.BANDWIDTH_OPTIMIZATION_THRESHOLD,
      speakerPrioritization: true,
      scrollable: false,
      pinningEnabled: true,
      zoomScale: this.getZoomScaleForThreshold(participantCount), // Apply zoom effect for > 2 participants
    };
  }

  /**
   * Calculate optimal grid dimensions based on participant count
   * Implements the user's proposed solution:
   * - 2 participants: 2x1 or 1x2
   * - 3 participants: 2x2 grid with 3 slots (2+1 centered)
   * - 4 participants: 2x2 grid with 4 slots
   * - 5 participants: 3x3 grid with 5 slots (3+2 centered)
   * - And so on...
   */
  private static calculateOptimalGridDimensions(participantCount: number): {
    cols: number;
    rows: number;
  } {
    // Use threshold constants for better maintainability
    if (participantCount === this.LAYOUT_THRESHOLDS.TWO_PARTICIPANTS) {
      return { cols: 2, rows: 1 }; // Side by side
    } else if (
      participantCount ===
      this.LAYOUT_THRESHOLDS.SMALL_GROUP_MAX - 1
    ) {
      // 3 participants
      return { cols: 2, rows: 2 }; // 2x2 grid with 3 slots
    } else if (participantCount === this.LAYOUT_THRESHOLDS.SMALL_GROUP_MAX) {
      // 4 participants
      return { cols: 2, rows: 2 }; // 2x2 grid with 4 slots
    } else if (participantCount <= 6) {
      return { cols: 3, rows: 2 }; // 3x2 grid for 5-6 participants
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.MEDIUM_GROUP_MAX) {
      // 7-9 participants
      return { cols: 3, rows: 3 }; // 3x3 grid
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.LARGE_GROUP_MAX) {
      // 10-16 participants
      return { cols: 4, rows: 4 }; // 4x4 grid
    } else if (participantCount <= 25) {
      return { cols: 5, rows: 5 }; // 5x5 grid for 17-25 participants
    } else if (participantCount <= 36) {
      return { cols: 6, rows: 6 }; // 6x6 grid for 26-36 participants
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.VERY_LARGE_MAX) {
      // 37-49 participants
      return { cols: 7, rows: 7 }; // 7x7 grid
    } else {
      // For 50+ participants, use speaker view
      return { cols: 2, rows: 1 };
    }
  }

  /**
   * Get optimal aspect ratio based on participant count thresholds
   * Prioritizes face visibility over strict aspect ratios
   */
  private static getAspectRatioForThreshold(participantCount: number): string {
    if (participantCount === this.LAYOUT_THRESHOLDS.SINGLE_PARTICIPANT) {
      return 'aspect-[16/9]'; // Full screen for single participant
    } else if (participantCount === this.LAYOUT_THRESHOLDS.TWO_PARTICIPANTS) {
      return 'aspect-[16/9]'; // Side-by-side works well with 16:9
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.SMALL_GROUP_MAX) {
      return 'aspect-[4/5]'; // Taller aspect ratio for 2x2 grid to increase video height
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.MEDIUM_GROUP_MAX) {
      return 'aspect-square'; // Square for 3x3 grid - optimal for faces
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.LARGE_GROUP_MAX) {
      return 'aspect-[3/4]'; // Portrait-like for 4x4 grid - better for faces
    } else {
      return 'aspect-[3/4]'; // Portrait-like for larger grids
    }
  }

  /**
   * Get optimal zoom scale based on participant count thresholds
   * Applies zoom-out effect for participant counts > 2 to show more area
   */
  private static getZoomScaleForThreshold(participantCount: number): number {
    if (participantCount <= this.LAYOUT_CONSTANTS.ZOOM_THRESHOLD) {
      return this.ZOOM_SCALES.NORMAL; // No zoom for 1-2 participants
    } else if (participantCount <= this.LAYOUT_THRESHOLDS.SMALL_GROUP_MAX + 2) {
      // 3-6 participants
      return this.ZOOM_SCALES.ZOOMED_OUT; // Slight zoom out
    } else {
      return this.ZOOM_SCALES.MORE_ZOOMED_OUT; // More zoom out for 7+ participants
    }
  }

  /**
   * Get layout-specific CSS classes with smooth transitions
   * Google Meet-style smooth animations with enhanced transitions
   * Now uses CSS Grid with fr units for equal space distribution
   */
  static getLayoutClasses(config: LayoutConfig): {
    container: string;
    grid: string;
    participant: string;
    mainSpeaker: string;
    secondarySpeaker: string;
    zoomScale: number;
  } {
    const sizeClasses = {
      full: 'w-full h-full',
      large: 'w-full h-full', // Use full height for better space utilization
      medium: 'w-full h-full', // Use full height for better space utilization
      small: 'w-full h-full', // Use full height for better space utilization
      thumbnail: 'w-full h-full', // Make thumbnails fluid too
    };

    // Enhanced transition classes for Google Meet-style fluidity
    const transitionClasses =
      'transition-all duration-500 ease-out transform-gpu';
    const participantTransitionClasses =
      'transition-all duration-300 ease-out transform-gpu';
    const containerTransitionClasses =
      'transition-all duration-700 ease-out transform-gpu';

    // Create CSS Grid template with fr units for equal space distribution
    // Note: gridTemplateColumns and gridTemplateRows are used in the renderer via style prop

    return {
      container: `w-full h-full ${config.padding} ${containerTransitionClasses} flex items-center justify-center`,
      grid: `grid ${config.gap} ${
        config.scrollable ? 'overflow-y-auto scrollbar-hide' : ''
      } place-items-stretch min-h-full max-w-5xl mx-auto ${transitionClasses}`,
      participant: `relative ${config.aspectRatio} ${
        sizeClasses[config.secondarySpeakerSize]
      } min-w-0 min-h-0 ${participantTransitionClasses} rounded-lg overflow-hidden shadow-lg hover:shadow-xl`,
      mainSpeaker: `relative ${config.aspectRatio} ${
        sizeClasses[config.mainSpeakerSize]
      } min-w-0 min-h-0 ${participantTransitionClasses} rounded-lg overflow-hidden shadow-lg hover:shadow-xl`,
      secondarySpeaker: `relative ${config.aspectRatio} ${
        sizeClasses[config.secondarySpeakerSize]
      } min-w-0 min-h-0 ${participantTransitionClasses} rounded-lg overflow-hidden shadow-lg hover:shadow-xl`,
      zoomScale: config.zoomScale, // Include zoom scale for CSS transform
    };
  }

  /**
   * Get participant prioritization score for sorting
   */
  static getParticipantPriority(
    participant: any,
    config: LayoutConfig
  ): number {
    if (!config.speakerPrioritization) return 0;

    let score = 0;

    // Active speaker gets highest priority
    if (participant.isSpeaking) score += 100;

    // Video enabled gets higher priority
    if (participant.mediaState?.videoEnabled) score += 50;

    // Audio enabled gets medium priority
    if (participant.mediaState?.audioEnabled) score += 25;

    // Recent activity gets low priority
    if (participant.lastActive && Date.now() - participant.lastActive < 30000) {
      score += 10;
    }

    return score;
  }
}
