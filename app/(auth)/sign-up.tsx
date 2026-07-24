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
  TouchableOpacity,
  View,
} from "react-native";

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
        className="flex-1 bg-[#F8FAFC]"
      >
        <ScrollView
          contentContainerClassName="grow justify-center px-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 items-center">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <MaterialIcons name="mark-email-read" size={24} color="#FFFFFF" />
            </View>
            <Text className="text-2xl font-bold text-slate-900" style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
              Check Your Email
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-400">
              We sent a code to{"\n"}<Text className="font-medium text-slate-600">{email}</Text>
            </Text>
          </View>

          {error ? (
            <View className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
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
      className="flex-1 bg-[#F8FAFC]"
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <MaterialIcons name="local-hospital" size={24} color="#FFFFFF" />
          </View>
          <Text className="text-2xl font-bold text-slate-900" style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
            Create Account
          </Text>
          <Text className="mt-1 text-sm text-slate-400">
            Start tracking your medications today
          </Text>
        </View>

        {error ? (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Password" placeholder="Min. 8 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Button title="Create Account" onPress={handleSignUp} loading={isLoading} disabled={isLoading} className="mt-1" />
        </View>

        <View className="my-5 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-slate-200" />
          <Text className="text-xs text-slate-400">or</Text>
          <View className="h-px flex-1 bg-slate-200" />
        </View>

        <View className="gap-2.5">
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="apple" onError={setError} />
          <OAuthButton provider="facebook" onError={setError} />
        </View>

        <View className="mt-6 items-center">
          <Text className="text-sm text-slate-400">Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text className="mt-0.5 text-sm font-semibold text-blue-600">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
