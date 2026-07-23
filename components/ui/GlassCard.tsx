import { View, type ViewProps, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: "light" | "default" | "dark";
  className?: string;
}

export function GlassCard({
  children,
  intensity = 50,
  tint = "light",
  className = "",
  style,
  ...props
}: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-soft ${className}`}
      style={[{ minHeight: 48 }, style]}
      {...props}
    >
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View className="relative p-5">
        {children}
      </View>
    </View>
  );
}
