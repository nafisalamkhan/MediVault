import { useState, useRef } from "react";
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Typography";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, radius, typography, shadows } from "@/lib/theme";

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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isSecure = secureTextEntry === true;

  return (
    <View className={`w-full ${className}`}>
      {label && (
        <Text
          style={{
            marginBottom: 6,
            fontSize: typography.bodySm.fontSize,
            color: colors.inkSecondary,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          secureTextEntry={isSecure && !isSecureVisible}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />
        {isSecure && (
          <Pressable
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            style={styles.eyeButton}
            accessibilityLabel={isSecureVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isSecureVisible ? "visibility-off" : "visibility"}
              size={20}
              color={colors.inkFaint}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text style={{ marginTop: 6, fontSize: 13, color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    position: "relative",
  },
  input: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.ink,
    fontWeight: "400",
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});