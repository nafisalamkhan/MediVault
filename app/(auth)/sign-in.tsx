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
import { Input, Button, Text, Typography, Card, GlassPanel } from "@/components/ui";
import { OAuthButton } from "@/components/OAuthButton";
import { colors, radius, typography, spacing } from "@/lib/theme";

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
          <Typography variant="heading2" style={styles.title}>Welcome Back</Typography>
          <Typography variant="bodyMd" style={styles.subtitle}>Sign in to access your medications</Typography>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Typography variant="bodySm" style={styles.errorText}>{error}</Typography>
          </View>
        ) : null}

        {/* Form */}
        <Card style={styles.formCard}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.signInBtn}
          />
        </Card>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Typography variant="eyebrow" style={styles.dividerText}>or</Typography>
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
          <Typography variant="bodyMd" style={styles.footerText}>{"Don't have an account? "}</Typography>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Typography variant="bodyMd" style={styles.footerLink}>Create Account</Typography>
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
    backgroundColor: colors.canvasSoft,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
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
    color: colors.ink,
  },
  subtitle: {
    marginTop: 6,
    color: colors.inkSecondary,
  },
  errorBox: {
    marginBottom: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.danger,
  },
  formCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.hairline,
  },
  dividerText: {
    color: colors.inkMuted,
  },
  oauth: {
    gap: spacing.md,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    color: colors.inkSecondary,
  },
  footerLink: {
    marginTop: 2,
    color: colors.primary,
  },
  signInBtn: {
    marginTop: spacing.md,
  },
});