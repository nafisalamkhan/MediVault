import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Input, Button, Text } from "@/components/ui";
import { OAuthButton } from "@/components/OAuthButton";
import { colors, fonts } from "@/lib/theme";

export default function SignIn() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!isLoaded) return;
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: trimmedEmail,
        password: trimmedPassword,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Additional steps required. Please try again.");
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.message || "An unexpected error occurred.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <MaterialIcons name="local-hospital" size={24} color={colors.white} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to access your medications</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            variant="parchment"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            variant="parchment"
          />

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
          />
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth */}
        <View style={styles.oauth}>
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="apple" onError={setError} />
          <OAuthButton provider="facebook" onError={setError} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{"Don't have an account? "}</Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoTile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 32,
    letterSpacing: -0.374,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 25,
    color: colors.inkSecondary,
  },
  errorBox: {
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
  },
  form: {
    gap: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairlineRgba,
  },
  dividerText: {
    fontSize: 12,
    color: colors.inkTertiary,
  },
  oauth: {
    gap: 10,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: colors.inkSecondary,
  },
  footerLink: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
});
