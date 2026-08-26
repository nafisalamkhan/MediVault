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
  | "display1" 
  | "display2" 
  | "heading1" 
  | "heading2" 
  | "heading3" 
  | "title" 
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
  display1: {
    fontSize: typography.display1.fontSize,
    fontWeight: typography.display1.fontWeight,
    lineHeight: typography.display1.lineHeight,
    letterSpacing: typography.display1.letterSpacing,
  },
  display2: {
    fontSize: typography.display2.fontSize,
    fontWeight: typography.display2.fontWeight,
    lineHeight: typography.display2.lineHeight,
    letterSpacing: typography.display2.letterSpacing,
  },
  heading1: {
    fontSize: typography.heading1.fontSize,
    fontWeight: typography.heading1.fontWeight,
    lineHeight: typography.heading1.lineHeight,
    letterSpacing: typography.heading1.letterSpacing,
  },
  heading2: {
    fontSize: typography.heading2.fontSize,
    fontWeight: typography.heading2.fontWeight,
    lineHeight: typography.heading2.lineHeight,
    letterSpacing: typography.heading2.letterSpacing,
  },
  heading3: {
    fontSize: typography.heading3.fontSize,
    fontWeight: typography.heading3.fontWeight,
    lineHeight: typography.heading3.lineHeight,
    letterSpacing: typography.heading3.letterSpacing,
  },
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    lineHeight: typography.title.lineHeight,
    letterSpacing: typography.title.letterSpacing,
  },
  bodyMd: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: typography.bodyMd.fontWeight,
    lineHeight: typography.bodyMd.lineHeight,
    letterSpacing: typography.bodyMd.letterSpacing,
  },
  bodySm: {
    fontSize: typography.bodySm.fontSize,
    fontWeight: typography.bodySm.fontWeight,
    lineHeight: typography.bodySm.lineHeight,
    letterSpacing: typography.bodySm.letterSpacing,
  },
  button: {
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
  },
  caption: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: typography.caption.letterSpacing,
  },
  eyebrow: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    lineHeight: typography.eyebrow.lineHeight,
    letterSpacing: typography.eyebrow.letterSpacing,
  },
};

export function Typography({
  variant = "bodyMd",
  style,
  className,
  ...props
}: TypographyProps) {
  return (
    <Text
      style={[
        {
          fontFamily: "System",
          color: colors.ink,
          ...VARIANT_STYLES[variant],
        },
        style,
      ]}
      className={className}
      {...props}
    />
  );
}