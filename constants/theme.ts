import { Platform } from "react-native";

const primaryColor = "#FF6B6B";
const secondaryColor = "#4ECDC4";

export const Colors = {
  light: {
    text: "#1A1A1A",
    textSecondary: "#6C757D",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6C757D",
    tabIconSelected: primaryColor,
    link: primaryColor,
    backgroundRoot: "#F8F9FA",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F8F9FA",
    backgroundTertiary: "#E9ECEF",
    primary: primaryColor,
    secondary: secondaryColor,
    success: "#3ECF8E",
    warning: "#FFA500",
    error: "#FF4757",
    info: "#5B7FFF",
    renterBadge: "#5B7FFF",
    hostBadge: "#3ECF8E",
    agentBadge: "#9B59B6",
    border: "#E9ECEF",
    cardShadow: "rgba(0, 0, 0, 0.1)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#A0A0A0",
    buttonText: "#FFFFFF",
    tabIconDefault: "#A0A0A0",
    tabIconSelected: primaryColor,
    link: primaryColor,
    backgroundRoot: "#1A1A1A",
    backgroundDefault: "#2A2A2A",
    backgroundSecondary: "#1A1A1A",
    backgroundTertiary: "#3A3A3A",
    primary: primaryColor,
    secondary: secondaryColor,
    success: "#3ECF8E",
    warning: "#FFA500",
    error: "#FF4757",
    info: "#5B7FFF",
    renterBadge: "#5B7FFF",
    hostBadge: "#3ECF8E",
    agentBadge: "#9B59B6",
    border: "#3A3A3A",
    cardShadow: "rgba(0, 0, 0, 0.2)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  inputHeight: 48,
  buttonHeight: 52,
  fabSize: 56,
  swipeButtonSize: 60,
  swipeButtonSmall: 48,
};

export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 34,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
