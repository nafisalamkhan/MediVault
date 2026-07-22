import { Text, TextProps } from "react-native";

type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";

interface TypographyProps extends TextProps {
  size?: TextSize;
  weight?: "normal" | "medium" | "semibold" | "bold";
  className?: string;
}

const sizeStyles: Record<TextSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};

const weightStyles: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

export function Typography({
  size = "base",
  weight = "normal",
  className = "",
  ...props
}: TypographyProps) {
  return (
    <Text
      className={`text-gray-900 dark:text-white ${sizeStyles[size]} ${weightStyles[weight]} ${className}`}
      {...props}
    />
  );
}
