export const colors = {
  primary: "#0075de",
  primaryActive: "#005bab",
  primarySoft: "rgba(0, 117, 222, 0.08)",
  primaryBorder: "rgba(0, 117, 222, 0.2)",

  secondary: "#213183",

  canvas: "#ffffff",
  canvasSoft: "#f6f5f4",
  surface: "#ffffff",

  ink: "#000000",
  inkSecondary: "#31302e",
  inkMuted: "#615d59",
  inkFaint: "#a39e98",

  hairline: "#e6e6e6",
  hairlineRgba: "rgba(0, 0, 0, 0.1)",

  danger: "#dd5b00",
  dangerSoft: "rgba(221, 91, 0, 0.1)",
  success: "#1aae39",
  successSoft: "rgba(26, 174, 57, 0.1)",

  accentSky: "#62aef0",
  accentPurple: "#d6b6f6",
  accentPink: "#ff64c8",
  accentOrange: "#dd5b00",
  accentTeal: "#2a9d99",
  accentGreen: "#1aae39",
  accentBrown: "#523410",

  white: "#ffffff",
  black: "#000000",
} as const;

export const radius = {
  xs: 4,
  sm: 5,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  xxl: 32,
} as const;

export const fonts = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
  light: "System",
} as const;

export const typography = {
  display1: {
    fontSize: 64,
    fontWeight: "700" as const,
    lineHeight: 64,
    letterSpacing: -2.125,
  },
  display2: {
    fontSize: 54,
    fontWeight: "700" as const,
    lineHeight: 56,
    letterSpacing: -1.875,
  },
  heading1: {
    fontSize: 40,
    fontWeight: "700" as const,
    lineHeight: 44,
    letterSpacing: -1,
  },
  heading2: {
    fontSize: 26,
    fontWeight: "700" as const,
    lineHeight: 32,
    letterSpacing: -0.625,
  },
  heading3: {
    fontSize: 22,
    fontWeight: "700" as const,
    lineHeight: 28,
    letterSpacing: -0.25,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 28,
    letterSpacing: -0.125,
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodySm: {
    fontSize: 15,
    fontWeight: "400" as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  button: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0.125,
  },
} as const;

export const shadows = {
  level0: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  level2: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;