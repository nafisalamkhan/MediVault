import { ViewProps } from "react-native";
import { LiquidGlass, LiquidGlassProps } from "./LiquidGlass";

interface GlassPanelProps extends ViewProps {
  tint?: LiquidGlassProps["blurTint"];
  intensity?: number;
  frost?: string;
}

export function GlassPanel({
  tint,
  intensity,
  frost,
  style,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <LiquidGlass
      blurTint={tint}
      blurIntensity={intensity}
      baseTint={frost}
      style={style}
      {...props}
    >
      {children}
    </LiquidGlass>
  );
}
