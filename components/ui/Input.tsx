import { useState } from "react";
import { Pressable, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Typography";
import { MaterialIcons } from "@expo/vector-icons";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({
  label,
  error,
  secureTextEntry,
  className = "",
  ...textInputProps
}: InputProps) {
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const isSecure = secureTextEntry === true;

  return (
    <View className={`w-full ${className}`}>
      {label && (
        <Text
          className="mb-1.5 text-sm font-medium text-slate-500"
          style={{ fontFamily: "SpaceGrotesk_500Medium" }}
        >
          {label}
        </Text>
      )}
      <View className="relative">
        <TextInput
          placeholderTextColor="#94A3B8"
          accessibilityLabel={label}
          secureTextEntry={isSecure && !isSecureVisible}
          className={`rounded-xl border bg-white px-4 py-3.5 pr-11 text-base text-slate-900 ${
            error
              ? "border-red-300 bg-red-50"
              : "border-slate-200"
          }`}
          style={{ fontFamily: "SpaceGrotesk_400Regular" }}
          {...textInputProps}
        />
        {isSecure && (
          <Pressable
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            className="absolute right-3 top-0 bottom-0 items-center justify-center"
            accessibilityLabel={isSecureVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isSecureVisible ? "visibility-off" : "visibility"}
              size={20}
              color="#94A3B8"
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text className="mt-1 text-sm text-red-500">{error}</Text>
      )}
    </View>
  );
}
