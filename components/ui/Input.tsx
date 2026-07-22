import { Text, TextInput, TextInputProps, View } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({
  label,
  error,
  className = "",
  ...textInputProps
}: InputProps) {
  return (
    <View className={`w-full ${className}`}>
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor="#9CA3AF"
        accessibilityLabel={label}
        className={`rounded-xl border bg-gray-50 px-4 py-3.5 text-base text-gray-900 dark:bg-gray-800 dark:text-white ${
          error
            ? "border-red-500"
            : "border-gray-300 dark:border-gray-600"
        }`}
        {...textInputProps}
      />
      {error && (
        <Text className="mt-1 text-sm text-red-500">{error}</Text>
      )}
    </View>
  );
}
