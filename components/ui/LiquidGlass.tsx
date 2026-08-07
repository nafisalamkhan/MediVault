import { Platform, StyleSheet, View, ViewProps } from "react-native";
import { BlurView, BlurViewProps } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { radius } from "@/lib/theme";

const GLOSS_COLORS = [
  "rgba(255,255,255,0.6)",
  "rgba(255,255,255,0.07)",
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.12)",
] as const;

const GLOSS_LOCATIONS = [0, 0.13, 0.5, 1] as const;

const CONTACT_SHADOW = "0px 3px 10px 0px rgba(0,0,0,0.1)";

const BEVEL_BORDER = {
  borderWidth: 1,
  borderStyle: "solid",
  borderTopColor: "rgba(255,255,255,0.7)",
  borderLeftColor: "rgba(255,255,255,0.5)",
  borderRightColor: "rgba(0,0,0,0.09)",
  borderBottomColor: "rgba(0,0,0,0.06)",
} as const;

const BEVEL_INNER =
  "inset 0px 1px 2px 0px rgba(255,255,255,0.55), inset 0px -2px 4px 0px rgba(0,0,0,0.05)";

export interface LiquidGlassProps extends ViewProps {
  /** Corner radius of the glass surface. Defaults to the resolved style radius, else radius.lg. */
  radius?: number;
  /** Backdrop blur intensity. Set to 0 (or below) to skip the BlurView entirely. */
  blurIntensity?: number;
  /** expo-blur tint. */
  blurTint?: BlurViewProps["tint"];
  /** Solid opaque base fill rendered beneath the blur so the surface keeps its
   *  color even where Android's experimental blur misbehaves. */
  surfaceColor?: string;
  /** Translucent fill layered over the blur (the "body" of the glass). */
  baseTint?: string;
  /** Toggle the diagonal specular highlight. Default true. */
  gloss?: boolean;
  /** Custom 4-stop specular gradient. */
  glossColors?: readonly [string, string, string, string];
  /** Custom gradient stop locations, aligned with glossColors. */
  glossLocations?: readonly [number, number, number, number];
  /** Toggle the refractive edge (bright top/left, dark bottom/right + inset bevel). Default true. */
  bevel?: boolean;
  /** Toggle the soft, tinted caustic drop shadow. Default true. */
  shadow?: boolean;
  /** Tint color for the caustic shadow. */
  shadowColor?: string;
}

export function LiquidGlass({
  radius: radiusProp,
  blurIntensity = 55,
  blurTint = "default",
  surfaceColor,
  baseTint = "rgba(255,255,255,0.32)",
  gloss = true,
  glossColors = GLOSS_COLORS,
  glossLocations = GLOSS_LOCATIONS,
  bevel = true,
  shadow = true,
  shadowColor = "rgba(0,102,204,0.3)",
  style,
  children,
  ...props
}: LiquidGlassProps) {
  const flat = StyleSheet.flatten(style);
  const surfaceRadius = radiusProp ?? flat?.borderRadius ?? radius.lg;

  return (
    <View
      style={[
        style,
        { borderRadius: surfaceRadius },
        shadow && {
          boxShadow: `${CONTACT_SHADOW}, 0px 14px 30px -8px ${shadowColor}`,
        },
      ]}
      {...props}
    >
        <View
          style={[
            styles.surface,
            { borderRadius: surfaceRadius },
            bevel && styles.bevel,
          ]}
        >
          {surfaceColor ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor }]}
            />
          ) : null}
          {blurIntensity > 0 ? (
            <BlurView
              tint={blurTint}
              intensity={blurIntensity}
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {baseTint ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: baseTint }]} />
        ) : null}
        {gloss ? (
          <LinearGradient
            colors={glossColors}
            locations={glossLocations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  bevel: {
    ...BEVEL_BORDER,
    boxShadow: BEVEL_INNER,
  },
});
