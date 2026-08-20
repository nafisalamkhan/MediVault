import "@/global.css";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ToastProvider } from "@/components/Toast";
import { configureNotifications, syncMedicationReminders } from "@/lib/notifications";
import { tokenCache } from "@/utils/tokenCache";
import * as SecureStore from "expo-secure-store";
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
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
      }
    }

    if (isLoaded && isSignedIn && userId) {
      checkOnboarding();
    } else if (isLoaded && !isSignedIn) {
      setOnboardingChecked(true);
      setOnboardingComplete(true);
    }
  }, [isLoaded, isSignedIn, userId, onboardingGeneration]);

  const prevInOnboardingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !onboardingChecked) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    // Re-check onboarding state when leaving the onboarding screen
    if (prevInOnboardingRef.current && !inOnboarding && isSignedIn && userId) {
      setOnboardingGeneration((g) => g + 1);
    }
    prevInOnboardingRef.current = inOnboarding;

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (isSignedIn && !inAuthGroup && !inOnboarding && !onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isSignedIn, onboardingChecked, onboardingComplete, segments, router, userId]);

  if (!isLoaded || !onboardingChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F5F7]">
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  if (isSignedIn && !onboardingComplete) {
    return (
      <>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
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
  const [fontsLoaded, fontsError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ToastProvider>
        <RootLayoutNav />
      </ToastProvider>
    </ClerkProvider>
  );
}
