import { ActivityIndicator, TouchableOpacity } from "react-native";
import { Text } from "./Typography";

type ButtonVariant = "primary" | "secondary" | "outline";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 active:bg-blue-700 shadow-medium",
  secondary: "bg-slate-100 active:bg-slate-200 border border-slate-200",
  outline: "border border-slate-300 bg-white active:bg-slate-50",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-slate-800",
  outline: "text-slate-700",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  className = "",
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      className={`items-center rounded-xl px-6 py-3.5 ${
        disabled ? "opacity-50" : ""
      } ${variantStyles[variant]} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : "#2563EB"}
          size="small"
        />
      ) : (
        <Text
          className={`text-base font-semibold ${textStyles[variant]}`}
          style={{ fontFamily: "SpaceGrotesk_700Bold" }}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
