import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography } from "@/components/ui";
import { colors, typography, spacing } from "@/lib/theme";

export default function HelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Typography variant="heading2" style={styles.headerTitle}>Help Center</Typography>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Getting Started</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Welcome to MediVault! This app helps you organize and manage your medical documents, prescriptions, and medication reminders all in one secure place.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Creating Patient Folders</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Tap the + button on the Home tab to create a patient folder. You can create folders for yourself, family members, or anyone caring for.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Scanning Documents</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Use the scan button (document icon) on the Home tab or inside a patient folder to capture medical documents, prescriptions, or lab results. The app will automatically crop and enhance the image.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Medication Reminders</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          After scanning a prescription, MediVault can extract medication information using AI. You can then enable daily reminders for each medication. Tap a medication in a patient folder to set custom reminder times.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>AI Explanation</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          For scanned prescriptions, tap Analyze with AI to get a plain-language explanation of the prescription, doctor details, and extracted medications. This requires an internet connection.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Data Privacy</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Core records remain stored locally on your device. Scanned document images are sent to the AI provider (Google Gemini) only when you start analysis. See our Privacy Policy for more details.
        </Typography>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Frequently Asked Questions</Typography>
        <View style={styles.faqItem}>
          <Typography variant="bodyMd" style={styles.faqQuestion}>Can I use MediVault offline?</Typography>
          <Typography variant="bodyMd" style={styles.faqAnswer}>Yes! All core features work offline. AI analysis requires an internet connection, and selected document images are sent to the AI provider only when you start analysis.</Typography>
        </View>
        <View style={styles.faqItem}>
          <Typography variant="bodyMd" style={styles.faqQuestion}>How do I backup my data?</Typography>
          <Typography variant="bodyMd" style={styles.faqAnswer}>Currently, data is stored locally on your device. We recommend using your device built-in backup (iCloud/iTunes for iOS, Google Backup for Android).</Typography>
        </View>
        <View style={styles.faqItem}>
          <Typography variant="bodyMd" style={styles.faqQuestion}>Can I export my data?</Typography>
          <Typography variant="bodyMd" style={styles.faqAnswer}>Data export is planned for a future update. For now, you can view and share individual documents.</Typography>
        </View>
        <Typography variant="eyebrow" style={styles.sectionTitle}>Contact Support</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          If you need further assistance, please email us at{" "}
          <TouchableOpacity
            onPress={() => Linking.openURL("mailto:support@medivault.app")}
            accessibilityRole="link"
            accessibilityLabel="Email support at support@medivault.app"
          >
            <Typography variant="bodyMd" style={styles.link}>support@medivault.app</Typography>
          </TouchableOpacity>
        </Typography>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
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
    paddingHorizontal: spacing.xl,
    paddingTop: 8,
    paddingBottom: 60,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: colors.inkMuted,
    textTransform: "uppercase",
  },
  bodyText: {
    color: colors.inkSecondary,
  },
  link: {
    color: colors.primary,
  },
  faqItem: {
    marginTop: 12,
  },
  faqQuestion: {
    marginBottom: 4,
    color: colors.ink,
  },
  faqAnswer: {
    color: colors.inkSecondary,
  },
});