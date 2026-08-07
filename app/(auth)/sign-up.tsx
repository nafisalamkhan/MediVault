import { Button, Input, Text } from "@/components/ui";
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
import { colors, fonts } from "@/lib/theme";

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
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitleCenter}>
              We sent a code to{"\n"}
              <Text style={styles.subtitleStrong}>{email}</Text>
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              variant="parchment"
            />
            <Button title="Verify Email" onPress={handleVerify} loading={isLoading} disabled={isLoading} />
            <Button
              title="Change Email Address"
              onPress={() => { setPendingVerification(false); setCode(""); setError(""); }}
              variant="secondary"
              disabled={isLoading}
            />
          </View>
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start tracking your medications today</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" variant="parchment" />
          <Input label="Password" placeholder="Min. 8 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" variant="parchment" />
          <Button title="Create Account" onPress={handleSignUp} loading={isLoading} disabled={isLoading} />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.oauth}>
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="apple" onError={setError} />
          <OAuthButton provider="facebook" onError={setError} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
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
  subtitleCenter: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 25,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  subtitleStrong: {
    color: colors.inkMuted80,
    fontFamily: fonts.semibold,
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
