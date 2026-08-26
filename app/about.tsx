import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography, Card } from "@/components/ui";
import { colors, radius, typography, spacing } from "@/lib/theme";

const FEATURES = [
  { icon: "folder", text: "Create patient folders for family members" },
  { icon: "document-scanner", text: "Scan and store medical documents & prescriptions" },
  { icon: "auto-awesome", text: "AI-powered prescription analysis & explanation" },
  { icon: "notifications", text: "Smart medication reminders with custom times" },
  { icon: "security", text: "Core records stored locally. Selected document images sent to AI provider when analyzing." },
  { icon: "wifi-off", text: "Core features work offline. AI analysis requires internet connection." },
];

export default function About() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Typography variant="heading2" style={styles.headerTitle}>About MediVault</Typography>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutHeader}>
          <View style={styles.aboutIcon}>
            <MaterialIcons name="local-hospital" size={48} color={colors.white} />
          </View>
          <Typography variant="heading2" style={styles.aboutName}>MediVault</Typography>
          <Typography variant="bodySm" style={styles.aboutVersion}>Version 1.0.0</Typography>
        </View>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Your Personal Medical Vault</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          MediVault is an offline-first medication and document tracker designed to help you stay organized with your health information. Whether you are managing your own prescriptions or caring for family members, MediVault keeps everything secure and accessible.
        </Typography>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Key Features</Typography>
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <MaterialIcons name={f.icon as any} size={20} color={colors.primary} />
              </View>
              <Typography variant="bodyMd" style={styles.featureText}>{f.text}</Typography>
            </View>
          ))}
        </View>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Privacy First</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          We believe your health data belongs to you. MediVault stores everything locally on your device using SQLite. No cloud sync, no tracking, no analytics. Your medical information stays private.
        </Typography>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Technology</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Built with React Native, Expo, and Expo Router. Uses Expo SQLite for local storage, Clerk for optional authentication, and Google Gemini AI for prescription analysis (optional, requires internet).
        </Typography>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Open Source</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          MediVault is open source. View the source code and contribute at:
        </Typography>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://github.com/nafisalamkhan/MediVault")}
          accessibilityRole="link"
          accessibilityLabel="Open MediVault GitHub repository"
        >
          <Typography variant="bodyMd" style={styles.link}>https://github.com/nafisalamkhan/MediVault</Typography>
        </TouchableOpacity>

        <Typography variant="eyebrow" style={styles.sectionTitle}>Acknowledgments</Typography>
        <Typography variant="bodyMd" style={styles.bodyText}>
          Icons by Google Material Icons. Font: Inter (System). Built with Expo and React Native.
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
    color: colors.ink,
  },
  aboutVersion: {
    marginTop: 2,
    color: colors.inkMuted,
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
    color: colors.inkSecondary,
  },
});