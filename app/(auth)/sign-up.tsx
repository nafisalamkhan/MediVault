import { Button, Input, Text, Typography, Card } from "@/components/ui";
import { OAuthButton } from "@/components/OAuthButton";
import { useSignUp } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radius, typography, spacing } from "@/lib/theme";

export default function SignUp() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isSubmitting = useRef(false);

  async function handleSignUp() {
    if (!isLoaded || isSubmitting.current) return;
    isSubmitting.current = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) { setError("Please fill in all fields."); isSubmitting.current = false; return; }
    if (!trimmedEmail.includes("@")) { setError("Please enter a valid email address."); isSubmitting.current = false; return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); isSubmitting.current = false; return; }

    setIsLoading(true);
    setError("");
    try {
      await signUp.create({ emailAddress: trimmedEmail, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.message || "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  }

  async function handleVerify() {
    if (!isLoaded || isSubmitting.current || !code) return;
    isSubmitting.current = true;
    setIsLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification failed. Please check the code and try again.");
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.message || "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  }

  // OTP Verification
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoTile}>
              <MaterialIcons name="mark-email-read" size={24} color={colors.white} />
            </View>
            <Typography variant="heading2" style={styles.title}>Check Your Email</Typography>
            <Typography variant="bodyMd" style={styles.subtitleCenter}>
              We sent a code to{"\n"}
              <Text style={styles.subtitleStrong}>{email}</Text>
            </Typography>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Typography variant="bodySm" style={styles.errorText}>{error}</Typography>
            </View>
          ) : null}

          <Card style={styles.formCard}>
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button title="Verify Email" onPress={handleVerify} loading={isLoading} disabled={isLoading} style={styles.verifyBtn} />
            <Button
              title="Change Email Address"
              onPress={() => { setPendingVerification(false); setCode(""); setError(""); }}
              variant="secondary"
              disabled={isLoading}
              style={styles.changeEmailBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Sign Up Form
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <MaterialIcons name="local-hospital" size={24} color={colors.white} />
          </View>
          <Typography variant="heading2" style={styles.title}>Create Account</Typography>
          <Typography variant="bodyMd" style={styles.subtitle}>Start tracking your medications today</Typography>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Typography variant="bodySm" style={styles.errorText}>{error}</Typography>
          </View>
        ) : null}

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
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Button title="Create Account" onPress={handleSignUp} loading={isLoading} disabled={isLoading} style={styles.signUpBtn} />
        </Card>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Typography variant="eyebrow" style={styles.dividerText}>or</Typography>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.oauth}>
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="apple" onError={setError} />
          <OAuthButton provider="facebook" onError={setError} />
        </View>

        <View style={styles.footer}>
          <Typography variant="bodyMd" style={styles.footerText}>Already have an account? </Typography>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Typography variant="bodyMd" style={styles.footerLink}>Sign In</Typography>
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
  subtitleCenter: {
    marginTop: 6,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  subtitleStrong: {
    color: colors.inkMuted,
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
  verifyBtn: {
    marginTop: spacing.md,
  },
  changeEmailBtn: {
    marginTop: spacing.sm,
  },
  signUpBtn: {
    marginTop: spacing.md,
  },
});