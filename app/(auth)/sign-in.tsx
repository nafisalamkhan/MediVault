import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Input, Button, Text } from "@/components/ui";
import { OAuthButton } from "@/components/OAuthButton";

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
      className="flex-1 bg-[#F8FAFC]"
    >
      <View className="flex-1 px-6 justify-center">
        {/* Header */}
        <View className="mb-6 items-center">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <MaterialIcons name="local-hospital" size={24} color="#FFFFFF" />
          </View>
          <Text className="text-2xl font-bold text-slate-900" style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
            Welcome Back
          </Text>
          <Text className="mt-1 text-sm text-slate-400">
            Sign in to access your medications
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View className="gap-3">
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
            className="mt-1"
          />
        </View>

        {/* Divider */}
        <View className="my-5 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-slate-200" />
          <Text className="text-xs text-slate-400">or</Text>
          <View className="h-px flex-1 bg-slate-200" />
        </View>

        {/* OAuth */}
        <View className="gap-2.5">
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="apple" onError={setError} />
          <OAuthButton provider="facebook" onError={setError} />
        </View>

        {/* Footer */}
        <View className="mt-6 items-center">
          <Text className="text-sm text-slate-400">{"Don't have an account? "}</Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text className="mt-0.5 text-sm font-semibold text-blue-600">Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
