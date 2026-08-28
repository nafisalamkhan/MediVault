import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography, Card } from "@/components/ui";
import { colors, radius, spacing, shadows } from "@/lib/theme";

export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Typography variant="heading2" style={styles.headerTitle}>Privacy Policy</Typography>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="verified-user" size={28} color={colors.white} />
          </View>
          <Typography variant="heading3" style={styles.heroTitle}>Your privacy is our priority</Typography>
          <Typography variant="body" style={styles.heroBody}>Core records stay on your device. No cloud sync. No tracking.</Typography>
          <View style={styles.badge}>
            <Typography variant="caption" style={styles.badgeText}>Last updated: August 2025</Typography>
          </View>
        </Card>

        <Card style={styles.policyCard}>
          <PolicySection title="Data We Collect" body="MediVault is privacy-first. Personal health information stays on your device by default. We do not collect, transmit, or store your data on external servers unless you explicitly request AI analysis — only the selected document image is then sent to Google Gemini." />
          <View style={styles.divider} />
          <PolicySection title="Local Storage Only">
            <View style={styles.bulletList}>
              {["Patient folders and profiles", "Scanned documents and images", "Medication records and reminders", "AI analysis results (cached locally)", "App preferences and settings"].map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bulletIcon}>
                    <MaterialIcons name="check" size={12} color={colors.white} />
                  </View>
                  <Typography variant="body" style={styles.bulletText}>{item}</Typography>
                </View>
              ))}
            </View>
            <Typography variant="body" style={[styles.bodyText, { marginTop: 10 }]}>
              All data is stored exclusively in a local SQLite database via Expo SQLite. No cloud sync or remote storage is performed.
            </Typography>
          </PolicySection>
          <View style={styles.divider} />
          <PolicySection title="Camera & File System Access" body="Camera permission is used solely to capture documents, and file system access saves scanned images locally. These permissions are never used for any other purpose." />
          <View style={styles.divider} />
          <PolicySection title="AI Analysis (Optional)" body="When you choose to analyze a document with AI, only the image you explicitly select is sent to a third-party AI service (Google Gemini). No other data leaves your device. That provider's privacy policy applies to the transmission." />
          <View style={styles.divider} />
          <PolicySection title="Authentication (Clerk)" body="MediVault uses Clerk for optional authentication. If you sign in, Clerk handles credentials per their privacy policy. We receive only your Clerk user ID, profile image URL, full name, and primary email to associate your local data and show your profile. This linkage exists only while your account is active — you can request deletion at any time." />
          <View style={styles.divider} />
          <PolicySection title="No Analytics or Tracking" body="We include no analytics, crash reporting, or tracking libraries. Your usage is not monitored." />
          <View style={styles.divider} />
          <PolicySection title="Data Deletion" body="Delete any patient, document, or medication at any time from within the app. Uninstalling the app removes all local data from your device." />
          <View style={styles.divider} />
          <PolicySection title="Children Privacy" body="MediVault is not directed at children under 13. We do not knowingly collect data from children." />
          <View style={styles.divider} />
          <PolicySection title="Changes to This Policy" body="Updates will be reflected in-app with a new “Last updated” date." />
        </Card>

        <Card style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIcon}>
              <MaterialIcons name="mail" size={18} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.contactTitle}>Contact</Typography>
          </View>
          <Typography variant="body" style={styles.bodyText}>Questions about this policy?</Typography>
          <TouchableOpacity
            onPress={() => Linking.openURL("mailto:privacy@medivault.app")}
            accessibilityRole="link"
            accessibilityLabel="Email privacy team at privacy@medivault.app"
            style={styles.linkButton}
            activeOpacity={0.85}
          >
            <MaterialIcons name="email" size={16} color={colors.white} />
            <Typography variant="button" style={styles.linkButtonText}>privacy@medivault.app</Typography>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

function PolicySection({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.policySection}>
      <Typography variant="title" style={styles.sectionTitle}>{title}</Typography>
      {body ? <Typography variant="body" style={styles.bodyText}>{body}</Typography> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.ink,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...shadows.card,
  },
  heroTitle: {
    color: colors.ink,
    textAlign: "center",
  },
  heroBody: {
    marginTop: 6,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  badge: {
    marginTop: 12,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.inkMuted,
  },
  policyCard: {
    padding: spacing.lg,
  },
  policySection: {
    paddingVertical: 12,
  },
  sectionTitle: {
    color: colors.ink,
    marginBottom: 6,
  },
  bodyText: {
    color: colors.inkSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: 2,
  },
  bulletList: {
    marginTop: 8,
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: {
    flex: 1,
    color: colors.inkSecondary,
  },
  contactCard: {
    padding: spacing.lg,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contactTitle: {
    color: colors.ink,
  },
  linkButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 12,
    ...shadows.card,
  },
  linkButtonText: {
    color: colors.white,
  },
});
