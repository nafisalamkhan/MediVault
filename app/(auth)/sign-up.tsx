import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Input, Button } from "@/components/ui";

export default function SignUp() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (trimmedPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signUp.create({
        emailAddress: trimmedEmail,
        password: trimmedPassword,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      const errorMessage =
        err.errors?.[0]?.longMessage ||
        err.message ||
        "An unexpected error occurred.";
      Alert.alert("Authentication Error", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded || !code) return;

    setLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification failed. Please check the code and try again.");
      }
    } catch (err: any) {
      const errorMessage =
        err.errors?.[0]?.longMessage ||
        err.message ||
        "An unexpected error occurred.";
      Alert.alert("Authentication Error", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // OTP Verification Screen
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow px-8 pt-20 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-10">
            <Ionicons name="mail-open-outline" size={48} color="#2563EB" />
            <Text className="mt-4 text-3xl font-bold text-gray-900">
              Check Your Email
            </Text>
            <Text className="mt-2 text-base text-gray-500">
              We sent a verification code to{"\n"}
              <Text className="font-medium text-gray-800">{email}</Text>
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View className="mb-4 rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          {/* Code Input */}
          <View className="gap-4">
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button
              title="Verify Email"
              onPress={handleVerify}
              loading={loading}
              disabled={loading}
            />

            <Button
              title="Change Email Address"
              onPress={() => {
                setPendingVerification(false);
                setCode("");
                setError("");
              }}
              variant="secondary"
              disabled={loading}
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
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow px-8 pt-20 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-10">
          <Ionicons name="medkit" size={48} color="#2563EB" />
          <Text className="mt-4 text-3xl font-bold text-gray-900">
            Create Account
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            Start tracking your medications today
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View className="gap-4">
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

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
          />
        </View>

        {/* Footer */}
        <View className="mt-8 items-center">
          <Text className="text-sm text-gray-500">
            Already have an account?{" "}
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text className="mt-1 text-sm font-semibold text-blue-600">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
