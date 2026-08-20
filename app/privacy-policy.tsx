import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

const LOCAL_DATA_ITEMS = [
  "Patient folders and profiles",
  "Scanned documents and images",
  "Medication records and reminders",
  "AI analysis results (cached locally)",
  "App preferences and settings",
];

export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Last updated: August 2025</Text>
        </Text>
        <Text style={styles.sectionTitle}>1. Data We Collect</Text>
        <Text style={styles.bodyText}>
          MediVault is designed with privacy as a core principle. Personal health information remains on your device by default. We do not collect, transmit, or store your data on external servers unless you explicitly request AI analysis, in which case the selected document image is sent to Google Gemini for processing.
        </Text>
        <Text style={styles.sectionTitle}>2. Local Storage Only</Text>
        {LOCAL_DATA_ITEMS.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.bodyText}>
          All of the above data is stored exclusively in a local SQLite database on your device using Expo SQLite. No cloud synchronization or remote storage is performed by the app.
        </Text>
        <Text style={styles.sectionTitle}>3. Camera & File System Access</Text>
        <Text style={styles.bodyText}>
          MediVault requests camera permission to capture documents and file system access to save scanned images locally. These permissions are used solely for the app core functionality and are not used for any other purpose.
        </Text>
        <Text style={styles.sectionTitle}>4. AI Analysis (Optional)</Text>
        <Text style={styles.bodyText}>
          When you choose to analyze a document with AI, the image is sent to a third-party AI service (Google Gemini) for processing. Only the image you explicitly select is sent. No other data from your device is transmitted. The AI service privacy policy applies to that transmission.
        </Text>
        <Text style={styles.sectionTitle}>5. Authentication (Clerk)</Text>
        <Text style={styles.bodyText}>
          MediVault uses Clerk for optional user authentication. If you sign in, Clerk handles your account credentials according to their privacy policy. MediVault receives your Clerk user identifier, profile image URL, full name, and primary email address. This data is used solely to associate your local SQLite data with your account and to display your profile information within the app. We retain this data only while your account is active; you can request account deletion at any time, which removes the association between your Clerk identity and your local data.
        </Text>
        <Text style={styles.sectionTitle}>6. No Analytics or Tracking</Text>
        <Text style={styles.bodyText}>
          MediVault does not include any analytics, crash reporting, or user tracking libraries. Your usage patterns are not monitored.
        </Text>
        <Text style={styles.sectionTitle}>7. Data Deletion</Text>
        <Text style={styles.bodyText}>
          You can delete individual patients, documents, or medications at any time from within the app. Uninstalling the app will remove all local data from your device.
        </Text>
        <Text style={styles.sectionTitle}>8. Children Privacy</Text>
        <Text style={styles.bodyText}>
          MediVault is not directed at children under 13. We do not knowingly collect data from children.
        </Text>
        <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
        <Text style={styles.bodyText}>
          Any updates to this policy will be reflected in the app with a new Last updated date.
        </Text>
        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={styles.bodyText}>
          For questions about this privacy policy, contact us at <TouchableOpacity
          onPress={() => Linking.openURL("mailto:privacy@medivault.app")}
          accessibilityRole="link"
          accessibilityLabel="Email privacy team at privacy@medivault.app"
        >
          <Text style={styles.link}>privacy@medivault.app</Text>
        </TouchableOpacity>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
  bold: {
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  link: {
    color: colors.primary,
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    marginRight: 8,
    fontFamily: fonts.regular,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
});
