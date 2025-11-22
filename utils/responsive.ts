import { Dimensions, PixelRatio, Platform } from 'react-native';

// Base dimensions for scaling (iPhone 14 Pro)
const baseWidth = 393;
const baseHeight = 852;

/**
 * Get current screen dimensions
 */
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

/**
 * Scale size proportionally based on screen width
 * Maintains consistent sizing across different screen sizes
 */
export const scaleSize = (size: number): number => {
  const { width } = getScreenDimensions();
  const scale = width / baseWidth;
  const newSize = size * scale;
  
  // Round to nearest pixel
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale font size with minimum and maximum constraints
 * Prevents fonts from becoming too small on tiny screens or too large on tablets
 */
export const scaleFont = (size: number, maxScale: number = 1.3): number => {
  const { width } = getScreenDimensions();
  const scale = Math.min(width / baseWidth, maxScale);
  const newSize = size * scale;
  
  // Ensure minimum readable font size
  const minSize = Platform.OS === 'web' ? 12 : 11;
  return Math.max(Math.round(PixelRatio.roundToNearestPixel(newSize)), minSize);
};

/**
 * Moderate scale - less aggressive than full scaling
 * Good for spacing and padding that shouldn't scale as much as fonts
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const { width } = getScreenDimensions();
  const scale = width / baseWidth;
  return Math.round(size + (scale - 1) * size * factor);
};

/**
 * Scale vertically based on screen height
 * Useful for elements that depend on vertical space
 */
export const scaleVertical = (size: number): number => {
  const { height } = getScreenDimensions();
  const scale = height / baseHeight;
  const newSize = size * scale;
  
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Check if device is a small screen (width < 375px)
 */
export const isSmallDevice = (): boolean => {
  const { width } = getScreenDimensions();
  return width < 375;
};

/**
 * Check if device is a tablet (width >= 768px)
 */
export const isTablet = (): boolean => {
  const { width } = getScreenDimensions();
  return width >= 768;
};

/**
 * Get responsive spacing based on screen size
 */
export const getResponsiveSpacing = () => {
  const { width } = getScreenDimensions();
  
  // Smaller spacing on very small devices
  if (width < 360) {
    return {
      xs: 3,
      sm: 6,
      md: 10,
      lg: 14,
      xl: 20,
      xxl: 28,
    };
  }
  
  // Default spacing for normal phones
  if (width < 768) {
    return {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    };
  }
  
  // Larger spacing for tablets
  return {
    xs: 6,
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
    xxl: 48,
  };
};

/**
 * Get responsive typography based on screen size
 */
export const getResponsiveTypography = () => {
  return {
    hero: {
      fontSize: scaleFont(34, 1.2),
      fontWeight: '700' as const,
      lineHeight: scaleFont(42, 1.2),
    },
    h1: {
      fontSize: scaleFont(28, 1.2),
      fontWeight: '700' as const,
      lineHeight: scaleFont(36, 1.2),
    },
    h2: {
      fontSize: scaleFont(22, 1.2),
      fontWeight: '600' as const,
      lineHeight: scaleFont(28, 1.2),
    },
    h3: {
      fontSize: scaleFont(18, 1.2),
      fontWeight: '600' as const,
      lineHeight: scaleFont(24, 1.2),
    },
    body: {
      fontSize: scaleFont(16, 1.2),
      fontWeight: '400' as const,
      lineHeight: scaleFont(24, 1.2),
    },
    caption: {
      fontSize: scaleFont(14, 1.2),
      fontWeight: '400' as const,
      lineHeight: scaleFont(20, 1.2),
    },
    small: {
      fontSize: scaleFont(12, 1.2),
      fontWeight: '400' as const,
      lineHeight: scaleFont(16, 1.2),
    },
  };
};

/**
 * Create responsive styles hook
 * Returns current dimensions and helper functions
 */
export const useResponsiveDimensions = () => {
  const dimensions = getScreenDimensions();
  
  return {
    ...dimensions,
    scaleSize,
    scaleFont,
    moderateScale,
    scaleVertical,
    isSmallDevice: isSmallDevice(),
    isTablet: isTablet(),
    spacing: getResponsiveSpacing(),
    typography: getResponsiveTypography(),
  };
};
