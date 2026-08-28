import "@/global.css";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
    if (recheckingUserId !== null) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (prevInOnboardingRef.current && !inOnboarding && isSignedIn && userId) {
      setRecheckingUserId(userId);
      setOnboardingGeneration((g) => g + 1);
      return;
    }
    prevInOnboardingRef.current = inOnboarding;

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
        <ActivityIndicator size="large" color="#2563EB" />
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Drawer
          drawerContent={(props: any) => <DrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerActiveTintColor: "#2563EB",
            drawerInactiveTintColor: "#94A3B8",
            drawerItemStyle: { marginHorizontal: 12, borderRadius: 12 },
            drawerLabelStyle: { fontSize: 15, fontWeight: "500" },
          }}
        >
          <Drawer.Screen name="(tabs)" options={{ title: "Home", headerShown: false }} />
        </Drawer>
      </GestureHandlerRootView>
    </>
  );
}

function DrawerContent({ state, descriptors, navigation }: { state: any; descriptors: any; navigation: any }) {
  const { MaterialIcons } = require("@expo/vector-icons");
  const { useUser, useAuth } = require("@clerk/clerk-expo");
  const { useRouter } = require("expo-router");
  const { View, Text, TouchableOpacity, Image, StyleSheet, SafeAreaView } = require("react-native");

  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  return (
    <SafeAreaView style={drawerStyles.container}>
      <View style={drawerStyles.header}>
        {user?.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} style={drawerStyles.avatar} />
        ) : (
          <View style={[drawerStyles.avatar, drawerStyles.avatarPlaceholder]}>
            <MaterialIcons name="person" size={28} color="#94A3B8" />
          </View>
        )}
        <View style={drawerStyles.userInfo}>
          <Text style={drawerStyles.userName}>{user?.fullName || "MediVault User"}</Text>
          <Text style={drawerStyles.userEmail}>{user?.primaryEmailAddress?.emailAddress || "No email"}</Text>
        </View>
      </View>

      <View style={drawerStyles.divider} />

      <TouchableOpacity
        style={drawerStyles.item}
        onPress={() => { router.push("/(tabs)" as any); navigation.closeDrawer(); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go to Home"
      >
        <MaterialIcons name="home" size={24} color="#2563EB" />
        <Text style={drawerStyles.itemText}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={drawerStyles.item}
        onPress={() => { router.push("/settings" as any); navigation.closeDrawer(); }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="settings" size={24} color="#64748B" />
        <Text style={drawerStyles.itemText}>Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={drawerStyles.item}
        onPress={() => { navigation.navigate("help-center"); navigation.closeDrawer(); }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="help" size={24} color="#64748B" />
        <Text style={drawerStyles.itemText}>Help Center</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={drawerStyles.item}
        onPress={() => { navigation.navigate("privacy-policy"); navigation.closeDrawer(); }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="security" size={24} color="#64748B" />
        <Text style={drawerStyles.itemText}>Privacy Policy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={drawerStyles.item}
        onPress={() => { navigation.navigate("about"); navigation.closeDrawer(); }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="info" size={24} color="#64748B" />
        <Text style={drawerStyles.itemText}>About</Text>
      </TouchableOpacity>

      <View style={drawerStyles.divider} />

      <TouchableOpacity
        style={[drawerStyles.item, drawerStyles.dangerItem]}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={24} color="#EF4444" />
        <Text style={[drawerStyles.itemText, drawerStyles.dangerText]}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const drawerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEF2FF",
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
  },
  userEmail: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748B",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
    marginVertical: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  dangerItem: {
    backgroundColor: "#FEF2F2",
  },
  itemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0F172A",
  },
  dangerText: {
    color: "#EF4444",
  },
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});

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