import { useState } from "react";
import { Alert, Modal, ScrollView, Switch, TouchableOpacity, View, Image, StyleSheet, Text as RNText } from "react-native";
import { useRouter } from "expo-router";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, Button, Text } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors, fonts, typography, radius } from "@/lib/theme";

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
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

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

  function handleHelpCenter() { setShowHelpCenter(true); }
  function handlePrivacyPolicy() { setShowPrivacyPolicy(true); }
  function handleAbout() { setShowAbout(true); }

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

      {/* Help Center Modal */}
      <Modal visible={showHelpCenter} transparent animationType="fade" onRequestClose={() => setShowHelpCenter(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help Center</Text>
              <TouchableOpacity onPress={() => setShowHelpCenter(false)} style={styles.modalClose} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.inkTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Getting Started</Text>
              <Text style={styles.modalBodyText}>
                Welcome to MediVault! This app helps you organize and manage your medical documents, prescriptions, and medication reminders all in one secure place.
              </Text>
              <Text style={styles.modalSectionTitle}>Creating Patient Folders</Text>
              <Text style={styles.modalBodyText}>
                Tap the "+" button on the Home tab to create a patient folder. You can create folders for yourself, family members, or anyone you're caring for.
              </Text>
              <Text style={styles.modalSectionTitle}>Scanning Documents</Text>
              <Text style={styles.modalBodyText}>
                Use the scan button (document icon) on the Home tab or inside a patient folder to capture medical documents, prescriptions, or lab results. The app will automatically crop and enhance the image.
              </Text>
              <Text style={styles.modalSectionTitle}>Medication Reminders</Text>
              <Text style={styles.modalBodyText}>
                After scanning a prescription, MediVault can extract medication information using AI. You can then enable daily reminders for each medication. Tap a medication in a patient folder to set custom reminder times.
              </Text>
              <Text style={styles.modalSectionTitle}>AI Explanation</Text>
              <Text style={styles.modalBodyText}>
                For scanned prescriptions, tap "Analyze with AI" to get a plain-language explanation of the prescription, doctor details, and extracted medications. This requires an internet connection.
              </Text>
              <Text style={styles.modalSectionTitle}>Data Privacy</Text>
              <Text style={styles.modalBodyText}>
                All your data is stored locally on your device. MediVault does not upload your medical documents or personal information to any server. See our Privacy Policy for more details.
              </Text>
              <Text style={styles.modalSectionTitle}>Frequently Asked Questions</Text>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>Can I use MediVault offline?</Text>
                <Text style={styles.faqAnswer}>Yes! All core features work offline. Only AI analysis requires an internet connection.</Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>How do I backup my data?</Text>
                <Text style={styles.faqAnswer}>Currently, data is stored locally on your device. We recommend using your device's built-in backup (iCloud/iTunes for iOS, Google Backup for Android).</Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>Can I export my data?</Text>
                <Text style={styles.faqAnswer}>Data export is planned for a future update. For now, you can view and share individual documents.</Text>
              </View>
              <Text style={styles.modalSectionTitle}>Contact Support</Text>
              <Text style={styles.modalBodyText}>
                If you need further assistance, please email us at <Text style={styles.modalLink}>support@medivault.app</Text>
              </Text>
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyPolicy} transparent animationType="fade" onRequestClose={() => setShowPrivacyPolicy(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)} style={styles.modalClose} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.inkTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalBodyText}>
                <Text style={styles.modalBold}>Last updated: August 2025</Text>
              </Text>
              <Text style={styles.modalSectionTitle}>1. Data We Collect</Text>
              <Text style={styles.modalBodyText}>
                MediVault is designed with privacy as a core principle. We do not collect, transmit, or store any of your personal health information on external servers. All data remains on your device.
              </Text>
              <Text style={styles.modalSectionTitle}>2. Local Storage Only</Text>
              <Text style={styles.modalBodyText}>
                • Patient folders and profiles<br/>
                • Scanned documents and images<br/>
                • Medication records and reminders<br/>
                • AI analysis results (cached locally)<br/>
                • App preferences and settings
              </Text>
              <Text style={styles.modalBodyText}>
                All of the above data is stored exclusively in a local SQLite database on your device using Expo SQLite. No cloud synchronization or remote storage is performed by the app.
              </Text>
              <Text style={styles.modalSectionTitle}>3. Camera & File System Access</Text>
              <Text style={styles.modalBodyText}>
                MediVault requests camera permission to capture documents and file system access to save scanned images locally. These permissions are used solely for the app's core functionality and are not used for any other purpose.
              </Text>
              <Text style={styles.modalSectionTitle}>4. AI Analysis (Optional)</Text>
              <Text style={styles.modalBodyText}>
                When you choose to analyze a document with AI, the image is sent to a third-party AI service (Google Gemini) for processing. Only the image you explicitly select is sent. No other data from your device is transmitted. The AI service's privacy policy applies to that transmission.
              </Text>
              <Text style={styles.modalSectionTitle}>5. Authentication (Clerk)</Text>
              <Text style={styles.modalBodyText}>
                MediVault uses Clerk for optional user authentication. If you sign in, Clerk handles your account credentials according to their privacy policy. MediVault only receives a user identifier to associate your local data with your account.
              </Text>
              <Text style={styles.modalSectionTitle}>6. No Analytics or Tracking</Text>
              <Text style={styles.modalBodyText}>
                MediVault does not include any analytics, crash reporting, or user tracking libraries. Your usage patterns are not monitored.
              </Text>
              <Text style={styles.modalSectionTitle}>7. Data Deletion</Text>
              <Text style={styles.modalBodyText}>
                You can delete individual patients, documents, or medications at any time from within the app. Uninstalling the app will remove all local data from your device.
              </Text>
              <Text style={styles.modalSectionTitle}>8. Children's Privacy</Text>
              <Text style={styles.modalBodyText}>
                MediVault is not directed at children under 13. We do not knowingly collect data from children.
              </Text>
              <Text style={styles.modalSectionTitle}>9. Changes to This Policy</Text>
              <Text style={styles.modalBodyText}>
                Any updates to this policy will be reflected in the app with a new "Last updated" date.
              </Text>
              <Text style={styles.modalSectionTitle}>10. Contact</Text>
              <Text style={styles.modalBodyText}>
                For questions about this privacy policy, contact us at <Text style={styles.modalLink}>privacy@medivault.app</Text>
              </Text>
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* About MediVault Modal */}
      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About MediVault</Text>
              <TouchableOpacity onPress={() => setShowAbout(false)} style={styles.modalClose} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.inkTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.aboutHeader}>
                <View style={styles.aboutIcon}>
                  <MaterialIcons name="local-hospital" size={48} color={colors.white} />
                </View>
                <Text style={styles.aboutName}>MediVault</Text>
                <Text style={styles.aboutVersion}>Version 1.0.0</Text>
              </View>
              <Text style={styles.modalSectionTitle}>Your Personal Medical Vault</Text>
              <Text style={styles.modalBodyText}>
                MediVault is an offline-first medication and document tracker designed to help you stay organized with your health information. Whether you're managing your own prescriptions or caring for family members, MediVault keeps everything secure and accessible.
              </Text>
              <Text style={styles.modalSectionTitle}>Key Features</Text>
              <View style={styles.featureList}>
                <FeatureItem icon="folder" text="Create patient folders for family members" />
                <FeatureItem icon="document-scanner" text="Scan and store medical documents & prescriptions" />
                <FeatureItem icon="auto-awesome" text="AI-powered prescription analysis & explanation" />
                <FeatureItem icon="notifications" text="Smart medication reminders with custom times" />
                <FeatureItem icon="security" text="100% local storage - your data never leaves your device" />
                <FeatureItem icon="wifi-off" text="Works completely offline (except AI analysis)" />
              </View>
              <Text style={styles.modalSectionTitle}>Privacy First</Text>
              <Text style={styles.modalBodyText}>
                We believe your health data belongs to you. MediVault stores everything locally on your device using encrypted SQLite. No cloud sync, no tracking, no analytics. Your medical information stays private.
              </Text>
              <Text style={styles.modalSectionTitle}>Technology</Text>
              <Text style={styles.modalBodyText}>
                Built with React Native, Expo, and Expo Router. Uses Expo SQLite for local storage, Clerk for optional authentication, and Google Gemini AI for prescription analysis (optional, requires internet).
              </Text>
              <Text style={styles.modalSectionTitle}>Open Source</Text>
              <Text style={styles.modalBodyText}>
                MediVault is open source. View the source code and contribute at:
              </Text>
              <Text style={styles.modalLink}>https://github.com/medivault/medivault</Text>
              <Text style={styles.modalSectionTitle}>Acknowledgments</Text>
              <Text style={styles.modalBodyText}>
                Icons by Google Material Icons. Fonts by Google Fonts (Space Grotesk). Built with Expo and React Native.
              </Text>
            </ScrollView>
          </Card>
        </View>
      </Modal>
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
          trackColor={{ false: colors.surfaceTile2, true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.surfaceTile2}
        />
      )}
      {item.type === "action" && <MaterialIcons name="chevron-right" size={16} color={colors.inkTertiary} />}
    </TouchableOpacity>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <MaterialIcons name={icon as any} size={20} color={colors.primary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  modalClose: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: 500,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
  modalBold: {
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  modalLink: {
    color: colors.primary,
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  faqItem: {
    marginTop: 12,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
  aboutHeader: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  aboutIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  aboutName: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  aboutVersion: {
    fontSize: 14,
    color: colors.inkTertiary,
    marginTop: 2,
  },
  featureList: {
    marginTop: 8,
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
});
