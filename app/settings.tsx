import { useState } from "react";
import { Alert, ScrollView, Switch, TouchableOpacity, View, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, Button, Text, Typography } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors, radius, typography, spacing } from "@/lib/theme";

type SettingItem = {
  icon: string;
  label: string;
  description: string;
  type: "toggle" | "action";
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  accessibilityLabel?: string;
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

  const accountSettings: SettingItem[] = [
    { icon: "lock", label: "Biometric Lock", description: "Require Face ID / Fingerprint to open app", type: "toggle", value: biometricLock, onToggle: setBiometricLock },
    { icon: "vpn-key", label: "Change Password", description: "Update your account password", type: "action", onPress: () => showToast("Password management coming soon", "info") },
  ];

  const preferencesSettings: SettingItem[] = [
    { icon: "notifications", label: "Push Notifications", description: "Get reminders for your medications", type: "toggle", value: notifications, onToggle: setNotifications },
  ];

  const supportSettings: SettingItem[] = [
    { icon: "help", label: "Help Center", description: "Get support and FAQs", type: "action", onPress: () => router.push("/help-center"), accessibilityLabel: "Help Center" },
    { icon: "security", label: "Privacy Policy", description: "How we handle your data", type: "action", onPress: () => router.push("/privacy-policy"), accessibilityLabel: "Privacy Policy" },
    { icon: "info", label: "About MediVault", description: "Version 1.0.0", type: "action", onPress: () => router.push("/about"), accessibilityLabel: "About MediVault" },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Typography variant="heading2" style={styles.title}>Settings</Typography>

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
            <Typography variant="title" style={styles.profileName}>{user?.fullName || "MediVault User"}</Typography>
            <Typography variant="bodySm" style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress || "No email"}</Typography>
            {user?.primaryEmailAddress?.verification?.status === "verified" && (
              <View style={styles.verifiedRow}>
                <MaterialIcons name="check-circle" size={14} color={colors.primary} />
                <Typography variant="caption" style={styles.verifiedText}>Verified</Typography>
              </View>
            )}
          </View>
        </Card>

        {/* Account Security */}
        <Typography variant="eyebrow" style={styles.sectionLabel}>Account Security</Typography>
        <Card style={styles.sectionCard} padding={0}>
          {accountSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === accountSettings.length - 1} />
          ))}
        </Card>

        {/* Preferences */}
        <Typography variant="eyebrow" style={styles.sectionLabel}>Preferences</Typography>
        <Card style={styles.sectionCard} padding={0}>
          {preferencesSettings.map((item, i) => (
            <SettingsRow key={item.label} item={item} isLast={i === preferencesSettings.length - 1} />
          ))}
        </Card>

        {/* Support & About */}
        <Typography variant="eyebrow" style={styles.sectionLabel}>Support & About</Typography>
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
  const rowStyle = [styles.row, !isLast && styles.rowBorder];

  if (item.type === "toggle") {
    return (
      <View style={rowStyle}>
        <View style={styles.rowIcon}>
          <MaterialIcons name={item.icon as any} size={18} color={colors.primary} />
        </View>
        <View style={styles.rowInfo}>
          <Typography variant="bodyMd" style={styles.rowLabel}>{item.label}</Typography>
          <Typography variant="caption" style={styles.rowDescription}>{item.description}</Typography>
        </View>
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: colors.hairline, true: colors.primary }}
          thumbColor={colors.white}
          accessibilityLabel={item.label}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={item.onPress}
      style={rowStyle}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
    >
      <View style={styles.rowIcon}>
        <MaterialIcons name={item.icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Typography variant="bodyMd" style={styles.rowLabel}>{item.label}</Typography>
        <Typography variant="caption" style={styles.rowDescription}>{item.description}</Typography>
      </View>
      <MaterialIcons name="chevron-right" size={16} color={colors.inkFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: 140,
  },
  title: {
    marginBottom: 24,
    color: colors.ink,
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
    color: colors.ink,
  },
  profileEmail: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  verifiedText: {
    color: colors.primary,
  },
  sectionLabel: {
    marginBottom: 10,
    marginLeft: 4,
    color: colors.inkMuted,
    textTransform: "uppercase",
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
    color: colors.ink,
  },
  rowDescription: {
    marginTop: 2,
    color: colors.inkMuted,
  },
});