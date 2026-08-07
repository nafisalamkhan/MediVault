import { ActivityIndicator, Pressable, PressableProps, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { colors, radius, fonts } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "utility" | "danger";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  ...props
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const labelStyle = labelStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        baseStyles.base,
        variantStyle.container,
        style,
        pressed && !disabled ? baseStyles.pressed : null,
        disabled || loading ? baseStyles.disabled : null,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.color} size="small" />
      ) : (
        <Text style={[baseStyles.label, labelStyle.label]}>{title}</Text>
      )}
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.374,
  },
});

const variantStyles: Record<ButtonVariant, any> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
    },
    color: colors.white,
  },
  secondary: {
    container: {
      backgroundColor: "transparent",
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    color: colors.primary,
  },
  outline: {
    container: {
      backgroundColor: colors.surfacePearl,
      borderRadius: radius.md,
      borderWidth: 3,
      borderColor: colors.dividerSoft,
    },
    color: colors.inkMuted80,
  },
  utility: {
    container: {
      backgroundColor: colors.ink,
      borderRadius: radius.sm,
      minHeight: 38,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    color: colors.white,
  },
  danger: {
    container: {
      backgroundColor: colors.danger,
      borderRadius: radius.pill,
    },
    color: colors.white,
  },
};

const labelStyles: Record<ButtonVariant, any> = {
  primary: {
    label: { color: colors.white, fontFamily: fonts.regular },
  },
  secondary: {
    label: { color: colors.primary, fontFamily: fonts.semibold },
  },
  outline: {
    label: { color: colors.inkMuted80, fontFamily: fonts.regular },
  },
  utility: {
    label: { color: colors.white, fontFamily: fonts.regular },
  },
  danger: {
    label: { color: colors.white, fontFamily: fonts.regular },
  },
};
