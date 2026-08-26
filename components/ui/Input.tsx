import { useState } from "react";
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Typography";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, radius, typography } from "@/lib/theme";

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
          style={{
            marginBottom: 6,
            fontSize: typography.bodySm.fontSize,
            color: colors.inkSecondary,
            fontWeight: "400",
          }}
        >
          {label}
        </Text>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          secureTextEntry={isSecure && !isSecureVisible}
          style={[
            styles.input,
            error && styles.inputError,
          ]}
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
        <Text style={{ marginTop: 4, fontSize: 13, color: colors.danger }}>
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
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 44,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.ink,
    fontWeight: "400",
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});