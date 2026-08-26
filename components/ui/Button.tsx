import { ActivityIndicator, Pressable, PressableProps, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { colors, radius, typography, shadows } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";

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
      style={(state) => [
        baseStyles.base,
        variantStyle.container,
        typeof style === "function" ? style(state) : style,
        state.pressed && !disabled ? baseStyles.pressed : null,
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
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    fontWeight: typography.button.fontWeight,
  },
});

const variantStyles: Record<ButtonVariant, any> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    color: colors.white,
  },
  secondary: {
    container: {
      backgroundColor: colors.surfaceHover,
      borderWidth: 1,
      borderColor: colors.border,
    },
    color: colors.ink,
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    color: colors.primary,
  },
  danger: {
    container: {
      backgroundColor: colors.danger,
      ...shadows.card,
    },
    color: colors.white,
  },
};

const labelStyles: Record<ButtonVariant, any> = {
  primary: {
    label: { color: colors.white, fontWeight: "600" },
  },
  secondary: {
    label: { color: colors.ink, fontWeight: "600" },
  },
  outline: {
    label: { color: colors.primary, fontWeight: "600" },
  },
  danger: {
    label: { color: colors.white, fontWeight: "600" },
  },
};