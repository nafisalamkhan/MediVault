export const colors = {
  primary: "#2563EB",
  primaryActive: "#1D4ED8",
  primarySoft: "rgba(37, 99, 235, 0.08)",
  primaryBorder: "rgba(37, 99, 235, 0.2)",

  background: "#F8FAFC",
  backgroundSoft: "#F1F5F9",
  canvasSoft: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceHover: "#F1F5F9",

  ink: "#0F172A",
  inkSecondary: "#64748B",
  inkMuted: "#94A3B8",
  inkFaint: "#CBD5E1",

  border: "#E2E8F0",
  borderFocus: "#2563EB",
  hairline: "#E2E8F0",

  success: "#10B981",
  successSoft: "rgba(16, 185, 129, 0.1)",
  danger: "#EF4444",
  dangerSoft: "rgba(239, 68, 68, 0.1)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.1)",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  full: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const typography = {
  display: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heading1: {
    fontSize: 24,
    fontWeight: "700" as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heading2: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  heading3: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodySm: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
    letterSpacing: 0,
  },
  button: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 11,
    fontWeight: "500" as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "600" as const,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
} as const;

export const shadows = {
  none: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 8,
  },
  cardHover: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 48,
    elevation: 12,
  },
  fab: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;