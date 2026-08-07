import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewProps } from "react-native";
import { radius, spacing } from "@/lib/theme";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: number;
}

const CARD_GLOSS: readonly [string, string, string] = [
  "rgba(255,255,255,0.45)",
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.06)",
];

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
      <LinearGradient
        colors={CARD_GLOSS}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: cardRadius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderStyle: "solid",
    borderTopColor: "rgba(255,255,255,0.9)",
    borderLeftColor: "rgba(255,255,255,0.7)",
    borderBottomColor: "rgba(0,0,0,0.05)",
    borderRightColor: "rgba(0,0,0,0.08)",
    boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.04), 0px 10px 24px -10px rgba(0,102,204,0.18)",
  },
});
