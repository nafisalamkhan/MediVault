import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { styled } from "nativewind";
import { colors, fonts } from "@/lib/theme";

const StyledText = styled(RNText);

const WEIGHT_TO_FONT: Record<string, string> = {
  "100": fonts.light,
  "200": fonts.light,
  "300": fonts.light,
  "400": fonts.regular,
  "500": fonts.semibold,
  "600": fonts.semibold,
  "700": fonts.bold,
  "800": fonts.bold,
  "900": fonts.bold,
  normal: fonts.regular,
  bold: fonts.bold,
};

export function Text(props: TextProps & { className?: string }) {
  const { style, className, ...rest } = props;
  const flat = StyleSheet.flatten(style);
  const explicitFont = flat?.fontFamily as string | undefined;
  const weight = flat?.fontWeight as string | undefined;
  const explicitColor = flat?.color;

  const fontFamily =
    explicitFont || (weight ? WEIGHT_TO_FONT[weight] : undefined) || (className ? undefined : fonts.regular);

  const hasColorClass = className ? /\btext-/.test(className) : false;
  const computed: Record<string, string> = {};
  if (fontFamily) computed.fontFamily = fontFamily;
  if (!explicitColor && !hasColorClass) computed.color = colors.ink;

  return (
    <StyledText
      {...rest}
      className={className}
      style={Object.keys(computed).length > 0 ? [style, computed] : style}
    />
  );
}

type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";

type TextWeight = "light" | "normal" | "medium" | "bold";

interface TypographyProps extends TextProps {
  size?: TextSize;
  weight?: TextWeight;
  className?: string;
}

const FONTS: Record<TextWeight, string> = {
  light: fonts.light,
  normal: fonts.regular,
  medium: fonts.semibold,
  bold: fonts.bold,
};

const SIZE: Record<TextSize, number> = {
  xs: 12,
  sm: 14,
  base: 17,
  lg: 20,
  xl: 24,
  "2xl": 30,
  "3xl": 34,
};

const WEIGHT: Record<TextWeight, string> = {
  light: "300",
  normal: "400",
  medium: "600",
  bold: "700",
};

const TRACKING: Record<TextSize, number> = {
  xs: -0.12,
  sm: -0.224,
  base: -0.374,
  lg: -0.374,
  xl: -0.374,
  "2xl": -0.374,
  "3xl": -0.374,
};

const LINE_HEIGHT: Record<TextSize, number> = {
  xs: 17,
  sm: 20,
  base: 25,
  lg: 26,
  xl: 30,
  "2xl": 34,
  "3xl": 38,
};

export function Typography({
  size = "base",
  weight = "normal",
  style,
  className,
  ...props
}: TypographyProps) {
  return (
    <Text
      style={[
        {
          fontFamily: FONTS[weight],
          fontSize: SIZE[size],
          fontWeight: WEIGHT[weight] as any,
          lineHeight: LINE_HEIGHT[size],
          letterSpacing: TRACKING[size],
          color: colors.ink,
        },
        style,
      ]}
      className={className}
      {...props}
    />
  );
}
