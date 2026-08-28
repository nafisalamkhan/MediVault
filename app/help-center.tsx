import { useState } from "react";
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography, Card } from "@/components/ui";
import { colors, radius, spacing, shadows } from "@/lib/theme";

const GUIDE_ITEMS = [
  { icon: "folder", title: "Creating Patient Folders", desc: "Tap the + button on the Home tab to create a folder for yourself or family members. Each patient gets their own secure space for documents and medications." },
  { icon: "document-scanner", title: "Scanning Documents", desc: "Use the scan button on Home or inside a patient folder to capture prescriptions or lab results. The app auto-crops and enhances for readability." },
  { icon: "notifications", title: "Medication Reminders", desc: "After scanning, AI extracts medications. Enable daily reminders per medication and set custom times with a single tap." },
  { icon: "auto-awesome", title: "AI Explanation", desc: "Tap Analyze with AI on any prescription to get a plain-language summary, doctor details, and extracted medicines. Requires internet — only the selected image is sent to Google Gemini." },
  { icon: "security", title: "Data Privacy", desc: "Core records stay on your device (SQLite). No cloud sync, no tracking. See Privacy Policy for full details." },
];

const FAQS = [
  { q: "Can I use MediVault offline?", a: "Yes. All core features work offline. AI analysis needs internet and sends only the selected document image to the AI provider when you start analysis." },
  { q: "How do I backup my data?", a: "Data is local on your device. Use your system backup — iCloud / iTunes for iOS or Google Backup for Android — to keep a copy." },
  { q: "Can I export my data?", a: "Export to JSON/CSV is planned for a future update. For now you can view and share individual documents." },
];

export default function HelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="help-center" size={32} color={colors.white} />
          </View>
          <Typography variant="heading3" style={styles.heroTitle}>How can we help?</Typography>
          <Typography variant="body" style={styles.heroBody}>
            Welcome to MediVault — your secure vault for medical documents, prescriptions, and reminders. Explore the guides below or contact support.
          </Typography>
        </Card>

        <Typography variant="eyebrow" style={styles.sectionEyebrow}>Guides</Typography>
        {GUIDE_ITEMS.map((item) => (
          <Card key={item.title} style={styles.guideCard}>
            <View style={styles.guideRow}>
              <View style={styles.guideIcon}>
                <MaterialIcons name={item.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="title" style={styles.guideTitle}>{item.title}</Typography>
                <Typography variant="body" style={styles.guideDesc}>{item.desc}</Typography>
              </View>
            </View>
          </Card>
        ))}

        <Typography variant="eyebrow" style={styles.sectionEyebrow}>Frequently Asked Questions</Typography>
        <Card style={styles.faqCard}>
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <View key={faq.q} style={[styles.faqItem, idx > 0 && styles.faqDivider]}>
                <TouchableOpacity
                  onPress={() => setOpenFaq(isOpen ? null : idx)}
                  activeOpacity={0.7}
                  style={styles.faqRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${faq.q}, ${isOpen ? "collapse" : "expand"}`}
                >
                  <Typography variant="body" style={styles.faqQuestion}>{faq.q}</Typography>
                  <View style={[styles.faqChevron, isOpen && styles.faqChevronOpen]}>
                    <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.inkMuted} />
                  </View>
                </TouchableOpacity>
                {isOpen ? (
                  <Typography variant="body" style={styles.faqAnswer}>{faq.a}</Typography>
                ) : null}
              </View>
            );
          })}
        </Card>

        <Card style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIcon}>
              <MaterialIcons name="mail" size={20} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.contactTitle}>Contact Support</Typography>
          </View>
          <Typography variant="body" style={styles.contactBody}>
            Need further assistance? Our team is happy to help.
          </Typography>
          <TouchableOpacity
            onPress={() => Linking.openURL("mailto:support@medivault.app")}
            accessibilityRole="link"
            accessibilityLabel="Email support at support@medivault.app"
            style={styles.contactButton}
            activeOpacity={0.85}
          >
            <MaterialIcons name="email" size={18} color={colors.white} />
            <Typography variant="button" style={styles.contactButtonText}>Email Support</Typography>
          </TouchableOpacity>
        </Card>
      </ScrollView>
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...shadows.card,
  },
  heroTitle: {
    color: colors.ink,
    textAlign: "center",
  },
  heroBody: {
    marginTop: 8,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  sectionEyebrow: {
    marginTop: 4,
    color: colors.inkMuted,
  },
  guideCard: {
    padding: spacing.lg,
  },
  guideRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  guideTitle: {
    color: colors.ink,
  },
  guideDesc: {
    marginTop: 4,
    color: colors.inkSecondary,
  },
  faqCard: {
    padding: 0,
    overflow: "hidden",
  },
  faqItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  faqDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    color: colors.ink,
    fontWeight: "600",
  },
  faqChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  faqChevronOpen: {
    transform: [{ rotate: "180deg" }],
    backgroundColor: colors.primarySoft,
  },
  faqAnswer: {
    marginTop: 10,
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
  contactBody: {
    color: colors.inkSecondary,
  },
  contactButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadows.card,
  },
  contactButtonText: {
    color: colors.white,
  },
});
