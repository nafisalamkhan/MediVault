import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { styled } from "nativewind";

const StyledText = styled(RNText);

const WEIGHT_TO_FONT: Record<string, string> = {
  "100": "SpaceGrotesk_300Light",
  "200": "SpaceGrotesk_300Light",
  "300": "SpaceGrotesk_300Light",
  "400": "SpaceGrotesk_400Regular",
  "500": "SpaceGrotesk_500Medium",
  "600": "SpaceGrotesk_500Medium",
  "700": "SpaceGrotesk_700Bold",
  "800": "SpaceGrotesk_700Bold",
  "900": "SpaceGrotesk_700Bold",
  normal: "SpaceGrotesk_400Regular",
  bold: "SpaceGrotesk_700Bold",
};

export function Text(props: TextProps & { className?: string }) {
  const { style, className, ...rest } = props;
  const flat = StyleSheet.flatten(style);
  const explicitFont = flat?.fontFamily as string | undefined;
  const weight = flat?.fontWeight as string | undefined;

  const fontFamily =
    explicitFont || (weight ? WEIGHT_TO_FONT[weight] : undefined) || (className ? undefined : "SpaceGrotesk_400Regular");

  return (
    <StyledText
      {...rest}
      className={className}
      style={fontFamily ? [style, { fontFamily }] : style}
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
