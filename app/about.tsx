import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography, Card } from "@/components/ui";
import { colors, radius, spacing, shadows } from "@/lib/theme";

const FEATURES = [
  { icon: "folder", title: "Patient Folders", desc: "Organize family members in dedicated, secure spaces" },
  { icon: "document-scanner", title: "Scan & Store", desc: "Capture prescriptions and labs — auto-cropped and enhanced" },
  { icon: "auto-awesome", title: "AI Analysis", desc: "Gemini-powered explanation of prescriptions in plain language" },
  { icon: "notifications", title: "Smart Reminders", desc: "Daily medication alerts with custom times" },
  { icon: "security", title: "On-Device First", desc: "SQLite storage, no cloud sync, no tracking" },
  { icon: "wifi-off", title: "Works Offline", desc: "Core features available without internet" },
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
        <Typography variant="heading2" style={styles.headerTitle}>About</Typography>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="local-hospital" size={40} color={colors.white} />
          </View>
          <Typography variant="heading2" style={styles.heroName}>MediVault</Typography>
          <View style={styles.versionPill}>
            <Typography variant="caption" style={styles.versionText}>Version 1.0.0</Typography>
          </View>
          <Typography variant="body" style={styles.heroTagline}>Your Personal Medical Vault</Typography>
          <Typography variant="body" style={styles.heroDesc}>
            An offline-first tracker to keep health information organized, secure, and always accessible — for you and your family.
          </Typography>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="verified-user" size={18} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.sectionTitle}>Privacy First</Typography>
          </View>
          <Typography variant="body" style={styles.bodyText}>
            Your health data belongs to you. Everything is stored locally on your device using SQLite. No cloud, no analytics, no tracking — ever.
          </Typography>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="stars" size={18} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.sectionTitle}>Key Features</Typography>
          </View>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <MaterialIcons name={f.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" style={styles.featureTitle}>{f.title}</Typography>
                  <Typography variant="body" style={styles.featureDesc}>{f.desc}</Typography>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="memory" size={18} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.sectionTitle}>Built With</Typography>
          </View>
          <Typography variant="body" style={styles.bodyText}>
            React Native, Expo & Expo Router for cross-platform fluidity. Clerk for auth, Expo SQLite for local storage, and Google Gemini for optional AI analysis.
          </Typography>
          <View style={styles.techRow}>
            {["React Native", "Expo", "SQLite", "Gemini"].map((tech) => (
              <View key={tech} style={styles.techPill}>
                <Typography variant="caption" style={styles.techText}>{tech}</Typography>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="code" size={18} color={colors.primary} />
            </View>
            <Typography variant="title" style={styles.sectionTitle}>Open Source</Typography>
          </View>
          <Typography variant="body" style={styles.bodyText}>
            MediVault is open source. Contributions, issues, and ideas are welcome — help us make health tracking more private and accessible.
          </Typography>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://github.com/nafisalamkhan/MediVault")}
            accessibilityRole="link"
            accessibilityLabel="View MediVault on GitHub"
            style={styles.githubButton}
            activeOpacity={0.85}
          >
            <MaterialIcons name="open-in-new" size={18} color={colors.white} />
            <Typography variant="button" style={styles.githubButtonText}>View on GitHub</Typography>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...shadows.card,
  },
  heroName: {
    color: colors.ink,
  },
  versionPill: {
    marginTop: 8,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionText: {
    color: colors.inkMuted,
  },
  heroTagline: {
    marginTop: 8,
    color: colors.ink,
    fontWeight: "600",
    textAlign: "center",
  },
  heroDesc: {
    marginTop: 6,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  sectionCard: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: colors.ink,
  },
  bodyText: {
    color: colors.inkSecondary,
  },
  featureGrid: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureTitle: {
    color: colors.ink,
    fontWeight: "600",
  },
  featureDesc: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  techRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  techPill: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  techText: {
    color: colors.inkSecondary,
  },
  githubButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadows.card,
  },
  githubButtonText: {
    color: colors.white,
  },
});
