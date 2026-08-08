import { useState } from "react";
import { Pressable, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Typography";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, radius, fonts } from "@/lib/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  variant?: "default" | "parchment";
}

export function Input({
  label,
  error,
  secureTextEntry,
  className = "",
  variant = "default",
  ...textInputProps
}: InputProps) {
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const isSecure = secureTextEntry === true;
  const isParchment = variant === "parchment";

  return (
    <View className={`w-full ${className}`}>
      {label && (
        <Text
          className="mb-1.5"
          style={{ fontSize: 14, color: colors.inkSecondary, fontFamily: fonts.regular }}
        >
          {label}
        </Text>
      )}
      <View className="relative">
        <TextInput
          placeholderTextColor={colors.inkTertiary}
          accessibilityLabel={label}
          secureTextEntry={isSecure && !isSecureVisible}
          style={{
            borderRadius: isParchment ? radius.xl : radius.sm,
            borderWidth: 1,
            borderColor: error
              ? colors.danger
              : isParchment
              ? colors.hairlineRgba
              : colors.hairlineRgba,
            backgroundColor: error
              ? colors.dangerSoft
              : isParchment
              ? colors.canvasParchment
              : colors.canvas,
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingRight: isSecure ? 44 : 16,
            fontSize: 17,
            lineHeight: 22,
            color: colors.ink,
            fontFamily: fonts.regular,
          }}
          {...textInputProps}
        />
        {isSecure && (
          <Pressable
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            style={{
              position: "absolute",
              right: 8,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
            accessibilityLabel={isSecureVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isSecureVisible ? "visibility-off" : "visibility"}
              size={20}
              color={colors.inkTertiary}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text style={{ marginTop: 4, fontSize: 13, color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}
