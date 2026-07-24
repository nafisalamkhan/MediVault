import { useState } from "react";
import { Alert, ScrollView, Switch, TouchableOpacity, View, Image } from "react-native";
import { useRouter } from "expo-router";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { GlassCard, Text } from "@/components/ui";
import { useToast } from "@/components/Toast";
type SettingItem = {
  icon: string;
  label: string;
  description: string;
  type: "toggle" | "action";
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
};

export default function Settings() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      showToast("Signed out successfully", "success");
      router.replace("/(auth)/sign-in");
    } catch {
      Alert.alert("Error", "Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  function handleHelpCenter() { showToast("Help center coming soon", "info"); }
  function handlePrivacyPolicy() { showToast("Privacy policy coming soon", "info"); }
  function handleAbout() { Alert.alert("MediVault", "Version 1.0.0\nOffline-first medication tracker."); }

  const accountSettings: SettingItem[] = [
    { icon: "lock", label: "Biometric Lock", description: "Require Face ID / Fingerprint to open app", type: "toggle", value: biometricLock, onToggle: setBiometricLock },
    { icon: "vpn-key", label: "Change Password", description: "Update your account password", type: "action", onPress: () => showToast("Password management coming soon", "info") },
  ];

  const preferencesSettings: SettingItem[] = [
    { icon: "notifications", label: "Push Notifications", description: "Get reminders for your medications", type: "toggle", value: notifications, onToggle: setNotifications },
  ];

  const supportSettings: SettingItem[] = [
    { icon: "help", label: "Help Center", description: "Get support and FAQs", type: "action", onPress: handleHelpCenter },
    { icon: "security", label: "Privacy Policy", description: "How we handle your data", type: "action", onPress: handlePrivacyPolicy },
    { icon: "info", label: "About MediVault", description: "Version 1.0.0", type: "action", onPress: handleAbout },
  ];

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView contentContainerClassName="px-6 pt-14 pb-28" showsVerticalScrollIndicator={false}>
        <Text className="mb-6 text-3xl font-bold text-gray-900">Settings</Text>

        {/* Profile Header */}
        <GlassCard intensity={40} tint="light" className="mb-6 items-center py-6">
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} className="mb-3 h-20 w-20 rounded-full border-2 border-gray-200" accessibilityLabel="Profile picture" />
          ) : (
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-100">
              <MaterialIcons name="person" size={36} color="#9CA3AF" />
            </View>
          )}
          <Text className="text-lg font-bold text-gray-900">{user?.fullName || "MediVault User"}</Text>
          <Text className="mt-0.5 text-sm text-gray-400">{user?.primaryEmailAddress?.emailAddress || "No email"}</Text>
          {user?.primaryEmailAddress?.verification?.status === "verified" && (
            <View className="mt-1.5 flex-row items-center gap-1">
              <MaterialIcons name="check-circle" size={14} color="#2563EB" />
              <Text className="text-xs text-blue-600">Verified</Text>
            </View>
          )}
        </GlassCard>

        {/* Account Security */}
        <Text className="mb-3 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Account Security</Text>
        <GlassCard intensity={40} tint="light" className="mb-6 py-0">
          {accountSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === accountSettings.length - 1} />
          ))}
        </GlassCard>

        {/* Preferences */}
        <Text className="mb-3 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Preferences</Text>
        <GlassCard intensity={40} tint="light" className="mb-6 py-0">
          {preferencesSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === preferencesSettings.length - 1} />
          ))}
        </GlassCard>

        {/* Support & About */}
        <Text className="mb-3 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Support & About</Text>
        <GlassCard intensity={40} tint="light" className="mb-6 py-0">
          {supportSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === supportSettings.length - 1} />
          ))}
        </GlassCard>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
          className="items-center flex-row justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 px-6 py-4"
        >
          <MaterialIcons name={signingOut ? "hourglass-empty" : "logout"} size={20} color="#DC2626" />
          <Text className="text-base font-semibold text-red-600">
            {signingOut ? "Signing Out..." : "Sign Out"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SettingsRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={item.type === "action" ? 0.7 : 1}
      onPress={item.type === "action" ? item.onPress : undefined}
      className={`flex-row items-center px-4 py-4 ${!isLast ? "border-b border-gray-100" : ""}`}
    >
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100">
        <MaterialIcons name={item.icon as any} size={18} color="#6B7280" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{item.label}</Text>
        <Text className="mt-0.5 text-xs text-gray-400">{item.description}</Text>
      </View>
      {item.type === "toggle" && (
        <Switch value={item.value} onValueChange={item.onToggle} disabled trackColor={{ false: "#E5E7EB", true: "#93C5FD" }} thumbColor={item.value ? "#2563EB" : "#F3F4F6"} />
      )}
      {item.type === "action" && <MaterialIcons name="chevron-right" size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}
