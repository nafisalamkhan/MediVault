import { ActivityIndicator, Pressable, PressableProps, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { colors, radius, typography } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "utility" | "danger";

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
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
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
      borderRadius: radius.full,
    },
    color: colors.white,
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    color: colors.ink,
  },
  utility: {
    container: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      minHeight: 40,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    color: colors.ink,
  },
  danger: {
    container: {
      backgroundColor: colors.danger,
      borderRadius: radius.full,
    },
    color: colors.white,
  },
};

const labelStyles: Record<ButtonVariant, any> = {
  primary: {
    label: { color: colors.white, fontWeight: "500" },
  },
  secondary: {
    label: { color: colors.ink, fontWeight: "500" },
  },
  utility: {
    label: { color: colors.ink, fontWeight: "500" },
  },
  danger: {
    label: { color: colors.white, fontWeight: "500" },
  },
};