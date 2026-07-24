import { Text as RNText, TextProps } from "react-native";

export function Text(props: TextProps) {
  const { style, ...rest } = props;
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: "SpaceGrotesk_400Regular" }, style]}
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
  light: "SpaceGrotesk_300Light",
  normal: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_700Bold",
};

const SIZE: Record<TextSize, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

const WEIGHT: Record<TextWeight, string> = {
  light: "300",
  normal: "400",
  medium: "500",
  bold: "700",
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
          color: "#0F172A",
        },
        style,
      ]}
      className={className}
      {...props}
    />
  );
}
