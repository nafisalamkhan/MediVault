import { StyleSheet, View, ViewProps } from "react-native";
import { radius, spacing, colors } from "@/lib/theme";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: number;
}

export function Card({
  children,
  className = "",
  padding = spacing.lg,
  style,
  ...props
}: CardProps) {
  const flat = StyleSheet.flatten(style);
  const cardRadius = flat?.borderRadius ?? radius.lg;

  return (
    <View
      className={className}
      style={[styles.base, { borderRadius: cardRadius }, { padding }, style]}
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
  },
});