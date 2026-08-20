import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, Card, Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors, fonts, typography, radius } from "@/lib/theme";
import * as SecureStore from "expo-secure-store";
import {
  initializeDatabase,
  addPatient,
} from "@/lib/db";

function getOnboardingKey(userId: string): string {
  return `onboarding_complete_v1_${userId}`;
}

type OnboardingStep = "privacy" | "patient" | "scan" | "reminder" | "complete";

const STEPS: { id: OnboardingStep; title: string; icon: string }[] = [
  { id: "privacy", title: "Privacy First", icon: "security" },
  { id: "patient", title: "Create Patient", icon: "person-add" },
  { id: "scan", title: "Scan Documents", icon: "document-scanner" },
  { id: "reminder", title: "Set Reminders", icon: "notifications" },
  { id: "complete", title: "All Set!", icon: "check-circle" },
];

export default function Onboarding() {
  const router = useRouter();
  const { userId, isSignedIn } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ redirect?: string }>();

  const [stepIndex, setStepIndex] = useState(0);
  const [patientName, setPatientName] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [skippedPatient, setSkippedPatient] = useState(false);
  const [patientCreated, setPatientCreated] = useState(false);

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const markOnboardingComplete = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const key = getOnboardingKey(userId);
      await SecureStore.setItemAsync(key, "true");
      return true;
    } catch (e) {
      console.warn("Failed to save onboarding state:", e);
      return false;
    }
  }, [userId]);

  async function handleNext(explicitSkip?: boolean) {
    Keyboard.dismiss();

    const isExplicitSkip = typeof explicitSkip === "boolean" ? explicitSkip : false;

    if (currentStep.id === "patient" && !skippedPatient && !isExplicitSkip) {
      const name = patientName.trim();
      if (!name) {
        showToast("Please enter a patient name", "error");
        return;
      }
      if (!userId) {
        showToast("Please sign in first", "error");
        return;
      }
      if (!patientCreated) {
        setCreatingPatient(true);
        try {
          await initializeDatabase();
          await addPatient({ ownerId: userId, name }, userId);
          showToast(`Created patient "${name}"`, "success");
          setPatientCreated(true);
          setSkippedPatient(false);
        } catch (err: any) {
          Alert.alert("Error", err.message || "Failed to create patient");
          return;
        } finally {
          setCreatingPatient(false);
        }
      } else {
        setSkippedPatient(false);
      }
    }

    if (isLastStep) {
      const success = await markOnboardingComplete();
      if (!success) {
        showToast("Failed to save onboarding progress. Please try again.", "error");
        return;
      }
      const redirect = params.redirect || "/(tabs)";
      router.replace(redirect as any);
    } else {
      setStepIndex((prev) => prev + 1);
    }
  }

  function handleSkipPatient() {
    setSkippedPatient(true);
    handleNext(true);
  }

  function handleBack() {
    Keyboard.dismiss();
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  }

  if (!isSignedIn) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Signing you in...</Text>
      </View>
    );
  }

  const progress = (stepIndex + 1) / STEPS.length;

  return (
    <View style={styles.screen}>
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>
        <View style={styles.stepDots}>
          {STEPS.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.stepDot,
                i <= stepIndex && styles.stepDotActive,
                i === stepIndex && styles.stepDotCurrent,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={16} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back-ios" size={22} color={stepIndex > 0 ? colors.ink : colors.inkTertiary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepLabel}>{currentStep.title}</Text>
            <Text style={styles.stepNumber}>Step {stepIndex + 1} of {STEPS.length}</Text>
          </View>
          <View style={styles.backButton} />
        </View>

        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <MaterialIcons name={currentStep.icon as any} size={40} color={colors.white} />
          </View>
        </View>

        {currentStep.id === "privacy" && <PrivacyStep />}
        {currentStep.id === "patient" && <PatientStep patientName={patientName} setPatientName={setPatientName} />}
        {currentStep.id === "scan" && <ScanStep />}
        {currentStep.id === "reminder" && <ReminderStep />}
        {currentStep.id === "complete" && <CompleteStep />}
      </ScrollView>

      <View style={styles.bottomActions}>
        {currentStep.id === "patient" && !skippedPatient && (
          <TouchableOpacity
            onPress={handleSkipPatient}
            style={styles.skipButton}
            activeOpacity={0.7}
            accessibilityLabel="Skip creating patient for now"
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
        <Button
          title={isLastStep ? "Get Started" : "Continue"}
          onPress={() => handleNext()}
          loading={creatingPatient}
          disabled={currentStep.id === "patient" && !patientName.trim() && !skippedPatient}
          style={styles.continueButton}
        />
      </View>
    </View>
  );
}

function PrivacyStep() {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your Health Data Stays Private</Text>
      <Text style={styles.stepBody}>
        MediVault is built with privacy as a core principle. All your medical documents,
        patient profiles, and medication records are stored locally on your device only.
      </Text>
      <View style={styles.featureList}>
        <FeatureRow icon="lock" text="No cloud sync — your data never leaves your device" />
        <FeatureRow icon="visibility-off" text="No analytics, tracking, or crash reporting" />
        <FeatureRow icon="storage" text="Encrypted SQLite database on your phone" />
        <FeatureRow icon="wifi-off" text="Works completely offline (core features)" />
      </View>
      <Text style={styles.stepNote}>
        <Text style={styles.bold}>Optional AI Analysis:</Text>{" "}
        When you choose to analyze a prescription with AI, only the selected document
        image is sent to Google Gemini for processing. No other data is transmitted.
      </Text>
    </View>
  );
}

function PatientStep({ patientName, setPatientName }: { patientName: string; setPatientName: (v: string) => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your First Patient Folder</Text>
      <Text style={styles.stepBody}>
        Organize medications and documents for yourself or family members.
        Each patient gets their own secure folder.
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={patientName}
          onChangeText={setPatientName}
          placeholder={'Patient name (e.g., "John", "Mom", "Self")'}
          placeholderTextColor={colors.inkTertiary}
          autoFocus
          autoCapitalize="words"
          style={styles.textInput}
          accessibilityLabel="Patient name"
          onSubmitEditing={Keyboard.dismiss}
        />
      </View>
      <Text style={styles.stepHint}>
        You can add more patients later from the Home tab.
      </Text>
    </View>
  );
}

function ScanStep() {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Scan Medical Documents</Text>
      <Text style={styles.stepBody}>
        Use the scanner to capture prescriptions, lab results, or doctor notes.
        MediVault auto-crops and enhances your scans.
      </Text>
      <View style={styles.featureList}>
        <FeatureRow icon="crop" text="Auto-detect document edges & crop" />
        <FeatureRow icon="auto-fix-high" text="Enhance contrast & readability" />
        <FeatureRow icon="description" text="Extract text for search & AI analysis" />
        <FeatureRow icon="local-hospital" text="Save directly to a patient folder" />
      </View>
      <View style={styles.demoContainer}>
        <View style={styles.demoPhone}>
          <View style={styles.demoCamera} />
          <View style={styles.demoOverlay}>
            <MaterialIcons name="crop" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </View>
      <Text style={styles.stepHint}>
        Tap the scanner FAB (bottom-right) from any patient folder or Home tab.
      </Text>
    </View>
  );
}

function ReminderStep() {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Never Miss a Dose</Text>
      <Text style={styles.stepBody}>
        After scanning a prescription, MediVault extracts medications using AI.
        You can then enable smart daily reminders with custom times.
      </Text>
      <View style={styles.featureList}>
        <FeatureRow icon="schedule" text="AI extracts medication from prescriptions" />
        <FeatureRow icon="alarm-add" text="Set custom reminder times per medicine" />
        <FeatureRow icon="notifications" text="Native push notifications (no internet needed)" />
        <FeatureRow icon="edit" text="Adjust or disable anytime" />
      </View>
      <View style={styles.demoContainer}>
        <Card style={styles.demoCard}>
          <View style={styles.demoPill}>
            <View style={styles.demoPillIcon}>
              <MaterialIcons name="local-hospital" size={18} color={colors.primary} />
            </View>
            <View style={styles.demoPillText}>
              <Text style={styles.demoPillName}>Metformin 500mg</Text>
              <Text style={styles.demoPillTime}>8:00 AM · 8:00 PM</Text>
            </View>
            <View style={styles.demoSwitch} />
          </View>
        </Card>
      </View>
      <Text style={styles.stepHint}>
        Reminders work offline. Tap any medication in a patient folder to configure.
      </Text>
    </View>
  );
}

function CompleteStep() {
  return (
    <View style={[styles.stepContent, styles.completeContent]}>
      <View style={styles.successIcon}>
        <MaterialIcons name="check-circle" size={48} color={colors.success} />
      </View>
      <Text style={styles.completeTitle}>You are All Set!</Text>
      <Text style={styles.completeBody}>
        MediVault is ready to help you organize your medical information securely.
      </Text>
      <View style={styles.quickStartList}>
        <QuickStartItem icon="person-add" text="Add more patients from Home tab" />
        <QuickStartItem icon="document-scanner" text="Scan prescriptions & documents" />
        <QuickStartItem icon="auto-awesome" text="Analyze with AI for medication extraction" />
        <QuickStartItem icon="notifications" text="Enable reminders per medication" />
      </View>
      <Text style={styles.privacyReminder}>
        Remember: Your data stays on your device. See Settings → Privacy Policy for details.
      </Text>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <MaterialIcons name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function QuickStartItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.quickStartRow}>
      <View style={styles.quickStartIcon}>
        <MaterialIcons name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={styles.quickStartText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasParchment,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.inkTertiary,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepDots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hairline,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotCurrent: {
    width: 20,
    borderRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  stepLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  stepNumber: {
    marginTop: 2,
    fontSize: 12,
    color: colors.inkTertiary,
  },
  iconContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  iconBackground: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  stepContent: {
    gap: 16,
  },
  completeContent: {
    alignItems: "center",
    gap: 20,
  },
  stepTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: "600",
    lineHeight: typography.headline.lineHeight,
    letterSpacing: typography.headline.letterSpacing,
    color: colors.ink,
    fontFamily: fonts.semibold,
    textAlign: "center",
  },
  stepBody: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  featureList: {
    marginTop: 8,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 8,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
  stepNote: {
    marginTop: 16,
    paddingHorizontal: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkSecondary,
    fontFamily: fonts.regular,
  },
  bold: {
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  stepHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkTertiary,
    fontFamily: fonts.regular,
    textAlign: "center",
    fontStyle: "italic",
  },
  inputContainer: {
    marginTop: 8,
  },
  textInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  demoContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  demoPhone: {
    width: 160,
    height: 320,
    borderRadius: 24,
    backgroundColor: colors.ink,
    overflow: "hidden",
    position: "relative",
  },
  demoCamera: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  demoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  demoCard: {
    width: "100%",
    maxWidth: 300,
  },
  demoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  demoPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  demoPillText: {
    flex: 1,
  },
  demoPillName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  demoPillTime: {
    marginTop: 2,
    fontSize: 12,
    color: colors.inkSecondary,
  },
  demoSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    textAlign: "center",
  },
  completeBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  quickStartList: {
    marginTop: 24,
    width: "100%",
    gap: 10,
  },
  quickStartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  quickStartIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickStartText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted80,
    fontFamily: fonts.regular,
  },
  privacyReminder: {
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkTertiary,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  bottomActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: colors.canvasParchment,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineRgba,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.inkTertiary,
    fontFamily: fonts.regular,
  },
  continueButton: {
    flex: 1,
    marginLeft: 12,
  },
});