import { useState } from "react";
import { Alert, ScrollView, Switch, TouchableOpacity, View, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, Button, Text } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors, fonts, typography } from "@/lib/theme";

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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileInner}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.profileAvatar} accessibilityLabel="Profile picture" />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <MaterialIcons name="person" size={32} color={colors.primary} />
              </View>
            )}
            <Text style={styles.profileName}>{user?.fullName || "MediVault User"}</Text>
            <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress || "No email"}</Text>
            {user?.primaryEmailAddress?.verification?.status === "verified" && (
              <View style={styles.verifiedRow}>
                <MaterialIcons name="check-circle" size={14} color={colors.primary} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Account Security */}
        <Text style={styles.sectionLabel}>Account Security</Text>
        <Card style={styles.sectionCard} padding={0}>
          {accountSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === accountSettings.length - 1} />
          ))}
        </Card>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <Card style={styles.sectionCard} padding={0}>
          {preferencesSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === preferencesSettings.length - 1} />
          ))}
        </Card>

        {/* Support & About */}
        <Text style={styles.sectionLabel}>Support & About</Text>
        <Card style={styles.sectionCard} padding={0}>
          {supportSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === supportSettings.length - 1} />
          ))}
        </Card>

        {/* Sign Out */}
        <Button
          title={signingOut ? "Signing Out..." : "Sign Out"}
          variant="danger"
          onPress={handleSignOut}
          disabled={signingOut}
          loading={signingOut}
        />
      </ScrollView>
    </View>
  );
}

function SettingsRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={item.type === "action" ? 0.7 : 1}
      onPress={item.type === "action" ? item.onPress : undefined}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={styles.rowIcon}>
        <MaterialIcons name={item.icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{item.label}</Text>
        <Text style={styles.rowDescription}>{item.description}</Text>
      </View>
      {item.type === "toggle" && (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          disabled
          trackColor={{ false: colors.surfaceTile2, true: colors.primary }}
          thumbColor={item.value ? colors.white : colors.white}
          ios_backgroundColor={colors.surfaceTile2}
        />
      )}
      {item.type === "action" && <MaterialIcons name="chevron-right" size={16} color={colors.inkTertiary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 140,
  },
  title: {
    fontSize: typography.headline.fontSize,
    fontWeight: "600",
    lineHeight: typography.headline.lineHeight,
    letterSpacing: typography.headline.letterSpacing,
    color: colors.ink,
    fontFamily: fonts.semibold,
    marginBottom: 24,
  },
  profileCard: {
    marginBottom: 24,
  },
  profileInner: {
    alignItems: "center",
    paddingVertical: 8,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.hairline,
    marginBottom: 12,
  },
  profileAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 14,
    color: colors.inkSecondary,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  verifiedText: {
    fontSize: 13,
    color: colors.primary,
  },
  sectionLabel: {
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
  },
  sectionCard: {
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  rowDescription: {
    marginTop: 2,
    fontSize: 13,
    color: colors.inkTertiary,
  },
});
