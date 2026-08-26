import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { styled } from "nativewind";
import { colors, typography } from "@/lib/theme";

const StyledText = styled(RNText);

export function Text(props: TextProps & { className?: string }) {
  const { style, className, ...rest } = props;
  const flat = StyleSheet.flatten(style);
  const explicitColor = flat?.color;

  const hasColorClass = className ? /\btext-/.test(className) : false;
  const computed: Record<string, string> = {};
  if (!explicitColor && !hasColorClass) computed.color = colors.ink;

  return (
    <StyledText
      {...rest}
      className={className}
      style={Object.keys(computed).length > 0 ? [style, computed] : style}
    />
  );
}

type TypographyVariant = 
  | "display" 
  | "heading1" 
  | "heading2" 
  | "heading3" 
  | "title" 
  | "body" 
  | "bodyMd"
  | "bodySm" 
  | "button" 
  | "caption" 
  | "eyebrow";

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  className?: string;
}

const VARIANT_STYLES: Record<TypographyVariant, any> = {
  display: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    lineHeight: typography.display.lineHeight,
    letterSpacing: typography.display.letterSpacing,
    color: colors.ink,
  },
  heading1: {
    fontSize: typography.heading1.fontSize,
    fontWeight: typography.heading1.fontWeight,
    lineHeight: typography.heading1.lineHeight,
    letterSpacing: typography.heading1.letterSpacing,
    color: colors.ink,
  },
  heading2: {
    fontSize: typography.heading2.fontSize,
    fontWeight: typography.heading2.fontWeight,
    lineHeight: typography.heading2.lineHeight,
    letterSpacing: typography.heading2.letterSpacing,
    color: colors.ink,
  },
  heading3: {
    fontSize: typography.heading3.fontSize,
    fontWeight: typography.heading3.fontWeight,
    lineHeight: typography.heading3.lineHeight,
    letterSpacing: typography.heading3.letterSpacing,
    color: colors.ink,
  },
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
    letterSpacing: typography.title.letterSpacing,
    color: colors.ink,
  },
  body: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
    color: colors.inkSecondary,
  },
  bodySm: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: typography.bodySm.fontWeight,
    lineHeight: typography.bodySm.lineHeight,
    letterSpacing: typography.bodySm.letterSpacing,
    color: colors.inkMuted,
  },
  button: {
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.white,
  },
  caption: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: typography.caption.letterSpacing,
    color: colors.inkMuted,
  },
  bodyMd: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
    color: colors.inkSecondary,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: colors.inkMuted,
    textTransform: "uppercase",
  },
};

export function Typography({
  variant = "body",
  style,
  className,
  ...props
}: TypographyProps) {
  return (
    <Text
      style={[
        {
          fontFamily: "SpaceGrotesk",
          ...VARIANT_STYLES[variant],
        },
        style,
      ]}
      className={className}
      {...props}
    />
  );
}