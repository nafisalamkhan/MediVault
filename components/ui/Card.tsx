import { StyleSheet, View, ViewProps } from "react-native";
import { radius, spacing, colors, shadows } from "@/lib/theme";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: number;
  variant?: "default" | "elevated";
}

export function Card({
  children,
  className = "",
  padding = spacing.xl,
  variant = "default",
  style,
  ...props
}: CardProps) {
  const flat = StyleSheet.flatten(style);
  const cardRadius = flat?.borderRadius ?? radius.xl;

  return (
    <View
      className={className}
      style={[
        styles.base,
        variant === "elevated" && styles.elevated,
        { borderRadius: cardRadius },
        { padding },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card,
  },
  elevated: {
    ...shadows.cardHover,
  },
});