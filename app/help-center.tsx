import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

export default function HelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Getting Started</Text>
        <Text style={styles.bodyText}>
          Welcome to MediVault! This app helps you organize and manage your medical documents, prescriptions, and medication reminders all in one secure place.
        </Text>
        <Text style={styles.sectionTitle}>Creating Patient Folders</Text>
        <Text style={styles.bodyText}>
          Tap the + button on the Home tab to create a patient folder. You can create folders for yourself, family members, or anyone caring for.
        </Text>
        <Text style={styles.sectionTitle}>Scanning Documents</Text>
        <Text style={styles.bodyText}>
          Use the scan button (document icon) on the Home tab or inside a patient folder to capture medical documents, prescriptions, or lab results. The app will automatically crop and enhance the image.
        </Text>
        <Text style={styles.sectionTitle}>Medication Reminders</Text>
        <Text style={styles.bodyText}>
          After scanning a prescription, MediVault can extract medication information using AI. You can then enable daily reminders for each medication. Tap a medication in a patient folder to set custom reminder times.
        </Text>
        <Text style={styles.sectionTitle}>AI Explanation</Text>
        <Text style={styles.bodyText}>
          For scanned prescriptions, tap Analyze with AI to get a plain-language explanation of the prescription, doctor details, and extracted medications. This requires an internet connection.
        </Text>
        <Text style={styles.sectionTitle}>Data Privacy</Text>
        <Text style={styles.bodyText}>
          Core records remain stored locally on your device. Scanned document images are sent to the AI provider (Google Gemini) only when you start analysis. See our Privacy Policy for more details.
        </Text>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Can I use MediVault offline?</Text>
          <Text style={styles.faqAnswer}>Yes! All core features work offline. AI analysis requires an internet connection, and selected document images are sent to the AI provider only when you start analysis.</Text>
        </View>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>How do I backup my data?</Text>
          <Text style={styles.faqAnswer}>Currently, data is stored locally on your device. We recommend using your device built-in backup (iCloud/iTunes for iOS, Google Backup for Android).</Text>
        </View>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Can I export my data?</Text>
          <Text style={styles.faqAnswer}>Data export is planned for a future update. For now, you can view and share individual documents.</Text>
        </View>
        <Text style={styles.sectionTitle}>Contact Support</Text>
        <Text style={styles.bodyText}>
          If you need further assistance, please email us at <TouchableOpacity
          onPress={() => Linking.openURL("mailto:support@medivault.app")}
          accessibilityRole="link"
          accessibilityLabel="Email support at support@medivault.app"
        >
          <Text style={styles.link}>support@medivault.app</Text>
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
  link: {
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
});
