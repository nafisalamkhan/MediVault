import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About MediVault</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutHeader}>
          <View style={styles.aboutIcon}>
            <MaterialIcons name="local-hospital" size={48} color={colors.white} />
          </View>
          <Text style={styles.aboutName}>MediVault</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
        </View>

        <Text style={styles.sectionTitle}>Your Personal Medical Vault</Text>
        <Text style={styles.bodyText}>
          MediVault is an offline-first medication and document tracker designed to help you stay organized with your health information. Whether you are managing your own prescriptions or caring for family members, MediVault keeps everything secure and accessible.
        </Text>

        <Text style={styles.sectionTitle}>Key Features</Text>
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <MaterialIcons name={f.icon as any} size={20} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Privacy First</Text>
        <Text style={styles.bodyText}>
          We believe your health data belongs to you. MediVault stores everything locally on your device using SQLite. No cloud sync, no tracking, no analytics. Your medical information stays private.
        </Text>

        <Text style={styles.sectionTitle}>Technology</Text>
        <Text style={styles.bodyText}>
          Built with React Native, Expo, and Expo Router. Uses Expo SQLite for local storage, Clerk for optional authentication, and Google Gemini AI for prescription analysis (optional, requires internet).
        </Text>

        <Text style={styles.sectionTitle}>Open Source</Text>
        <Text style={styles.bodyText}>
          MediVault is open source. View the source code and contribute at:
        </Text>
        <Text style={styles.link}>https://github.com/nafisalamkhan/MediVault</Text>

        <Text style={styles.sectionTitle}>Acknowledgments</Text>
        <Text style={styles.bodyText}>
          Icons by Google Material Icons. Fonts by Google Fonts (Space Grotesk). Built with Expo and React Native.
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
    fontSize: 14,
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
