export const colors = {
  primary: "#0066CC",
  primaryFocus: "#0071E3",
  primaryOnDark: "#2997FF",

  primarySoft: "rgba(0,102,204,0.08)",
  primarySoftStrong: "rgba(0,102,204,0.14)",
  primaryBorder: "rgba(0,102,204,0.28)",

  canvas: "#FFFFFF",
  canvasParchment: "#F5F5F7",
  surfacePearl: "#FAFAFC",

  surfaceTile1: "#272729",
  surfaceTile2: "#2A2A2C",
  surfaceTile3: "#252527",
  surfaceBlack: "#000000",

  ink: "#1D1D1F",
  inkMuted80: "#333333",
  inkMuted48: "#7A7A7A",
  inkSecondary: "#6E6E73",
  inkTertiary: "#86868B",
  bodyOnDark: "#FFFFFF",
  bodyMuted: "#CCCCCC",

  dividerSoft: "#F0F0F0",
  hairline: "#E0E0E0",
  hairlineRgba: "rgba(0,0,0,0.08)",

  danger: "#FF3B30",
  dangerSoft: "rgba(255,59,48,0.10)",
  success: "#34C759",
  successSoft: "rgba(52,199,89,0.12)",
  white: "#FFFFFF",
} as const;

export const radius = {
  none: 0,
  xs: 5,
  sm: 8,
  md: 11,
  xl: 12,
  lg: 18,
  pill: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 17,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 80,
} as const;

export const fonts = {
  light: "SpaceGrotesk_300Light",
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  semibold: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_700Bold",
} as const;

export const typography = {
  heroDisplay: {
    fontSize: 56,
    fontWeight: "600" as const,
    lineHeight: 60,
    letterSpacing: -0.28,
  },
  displayLg: {
    fontSize: 40,
    fontWeight: "600" as const,
    lineHeight: 44,
    letterSpacing: 0,
  },
  displayMd: {
    fontSize: 34,
    fontWeight: "600" as const,
    lineHeight: 40,
    letterSpacing: -0.374,
  },
  headline: {
    fontSize: 32,
    fontWeight: "600" as const,
    lineHeight: 38,
    letterSpacing: -0.374,
  },
  lead: {
    fontSize: 28,
    fontWeight: "400" as const,
    lineHeight: 32,
    letterSpacing: 0.196,
  },
  tagline: {
    fontSize: 21,
    fontWeight: "600" as const,
    lineHeight: 25,
    letterSpacing: 0.231,
  },
  bodyStrong: {
    fontSize: 17,
    fontWeight: "600" as const,
    lineHeight: 22,
    letterSpacing: -0.374,
  },
  body: {
    fontSize: 17,
    fontWeight: "400" as const,
    lineHeight: 25,
    letterSpacing: -0.374,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    letterSpacing: -0.224,
  },
  captionStrong: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 18,
    letterSpacing: -0.224,
  },
  buttonLarge: {
    fontSize: 18,
    fontWeight: "300" as const,
    lineHeight: 18,
    letterSpacing: 0,
  },
  buttonUtility: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 18,
    letterSpacing: -0.224,
  },
  finePrint: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 12,
    letterSpacing: -0.12,
  },
} as const;
