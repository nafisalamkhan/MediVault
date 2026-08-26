import { ViewProps } from "react-native";
import { StyleSheet, View } from "react-native";
import { radius, colors, shadows } from "@/lib/theme";

interface GlassPanelProps extends ViewProps {
  variant?: "default" | "elevated";
}

export function GlassPanel({
  variant = "default",
  style,
  children,
  ...props
}: GlassPanelProps) {
  const isElevated = variant === "elevated";
  return (
    <View
      style={[
        styles.base,
        isElevated && styles.elevated,
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
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.xl,
  },
  elevated: {
    ...shadows.card,
  },
});