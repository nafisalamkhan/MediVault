import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

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
  primary: "bg-blue-600 active:bg-blue-700",
  secondary: "bg-gray-200 active:bg-gray-300",
  outline: "border border-blue-600 bg-transparent active:bg-blue-50",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-gray-800",
  outline: "text-blue-600",
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
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
