import "@/global.css";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ToastProvider } from "@/components/Toast";
import { configureNotifications, syncMedicationReminders } from "@/lib/notifications";
import { tokenCache } from "@/utils/tokenCache";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

configureNotifications();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function getOnboardingKey(userId: string): string {
  return `onboarding_complete_v1_${userId}`;
}

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to your .env file and restart the dev server."
  );
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingGeneration, setOnboardingGeneration] = useState(0);
  const [recheckingUserId, setRecheckingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      syncMedicationReminders(userId).catch((err) =>
        console.warn("[Notifications] Reminder sync failed:", err)
      );
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    async function checkOnboarding() {
      if (!userId) return;
      try {
        const key = getOnboardingKey(userId);
        const value = await SecureStore.getItemAsync(key);
        setOnboardingComplete(value === "true");
      } catch (e) {
        console.warn("Failed to read onboarding state:", e);
        setOnboardingComplete(false);
      } finally {
        setOnboardingChecked(true);
        setRecheckingUserId(null);
      }
    }

    if (isLoaded && isSignedIn && userId) {
      // Reset state when userId or generation changes
      setOnboardingChecked(false);
      setOnboardingComplete(false);
      checkOnboarding();
    } else if (isLoaded && !isSignedIn) {
      setOnboardingChecked(true);
      setOnboardingComplete(true);
      setRecheckingUserId(null);
    }
  }, [isLoaded, isSignedIn, userId, onboardingGeneration]);

  const prevInOnboardingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !onboardingChecked) return;
    if (recheckingUserId !== null) return; // Wait for re-check to complete

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    // Re-check onboarding state when leaving the onboarding screen
    if (prevInOnboardingRef.current && !inOnboarding && isSignedIn && userId) {
      setRecheckingUserId(userId);
      setOnboardingGeneration((g) => g + 1);
    }
    prevInOnboardingRef.current = inOnboarding;

    // Only evaluate redirects after onboarding state is settled for current user/generation
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (isSignedIn && !inAuthGroup && !inOnboarding && !onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isSignedIn, onboardingChecked, onboardingComplete, segments, router, userId, onboardingGeneration, recheckingUserId]);

  if (!isLoaded || !onboardingChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0075de" />
      </View>
    );
  }

  if (isSignedIn && !onboardingComplete) {
    return (
      <>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ToastProvider>
        <RootLayoutNav />
      </ToastProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f5f4",
  },
});