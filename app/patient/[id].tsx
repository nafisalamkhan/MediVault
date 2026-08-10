import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, Card, GlassPanel } from "@/components/ui";
import ReminderSettingsModal from "@/components/ReminderSettingsModal";
import { colors, radius, fonts } from "@/lib/theme";
import {
  initializeDatabase,
  getPatientById,
  getMedicationsByPatient,
  getDocumentsByPatient,
} from "@/lib/db";
import type { Patient, Medication, Document } from "@/lib/db/schema";
import { filterCombinedMedicines, normalizeMedicineName } from "@/lib/ai";
import {
  parseReminderTimes,
  deriveReminderTimes,
  scheduleMedicationReminder,
  cancelMedicationReminder,
  formatReminderTimes,
} from "@/lib/notifications";

const IMAGE_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 3,
} as const;

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [reminderEditor, setReminderEditor] = useState<Medication | null>(null);
  const [reminderBusyId, setReminderBusyId] = useState<number | null>(null);
  const [pendingReminder, setPendingReminder] = useState<{
    id: number;
    enabled: boolean;
  } | null>(null);

  const patientId = Number(id);

  // Show each distinct medicine once, collapsing name variants (e.g. "Tab
  // Metformin 500mg" vs "Metformin") that previously created duplicate rows.
  const visibleMeds = useMemo(() => {
    const seen = new Set<string>();
    const out: Medication[] = [];
    for (const m of filterCombinedMedicines(medications)) {
      const key = normalizeMedicineName(m.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out;
  }, [medications]);

  async function fetchData(uid: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await initializeDatabase();
      const p = await getPatientById(patientId, uid);
      setPatient(p);

      if (p) {
        const [meds, docs] = await Promise.all([
          getMedicationsByPatient(patientId, uid),
          getDocumentsByPatient(patientId, uid),
        ]);
        setMedications(meds);
        setDocuments(docs);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load patient data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!userId || !patientId) return;
      fetchData(userId);
    }, [userId, patientId]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRefresh() {
    if (userId) fetchData(userId, true);
  }

  // Applies an updated medicine to every DB row sharing the same normalized
  // name (they are the same drug from different scans), and refreshes the
  // details modal if it is showing that medicine.
  function applyMedicationUpdate(updated: Medication) {
    setMedications((prev) =>
      prev.map((m) =>
        m.id === updated.id
          ? updated
          : normalizeMedicineName(m.name) === normalizeMedicineName(updated.name)
          ? {
              ...m,
              reminderEnabled: updated.reminderEnabled,
              reminderTimes: updated.reminderTimes,
              reminderNotificationIds: updated.reminderNotificationIds,
            }
          : m
      )
    );
    setSelectedMed((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  function handleReminderSaved(updated: Medication) {
    applyMedicationUpdate(updated);
    setReminderEditor(null);
  }

  async function handleToggleReminder(med: Medication, enable: boolean) {
    if (!userId || reminderBusyId !== null) return;
    setPendingReminder({ id: med.id, enabled: enable });
    setReminderBusyId(med.id);
    try {
      if (enable) {
        let timesJson = med.reminderTimes;
        if (parseReminderTimes(timesJson).length === 0) {
          timesJson = JSON.stringify(deriveReminderTimes(med.frequency));
        }
        if (parseReminderTimes(timesJson).length === 0) {
          Alert.alert(
            "Cannot Set Reminder",
            "No schedule could be derived from this medicine's frequency."
          );
          return;
        }
        const result = await scheduleMedicationReminder(
          { ...med, reminderTimes: timesJson },
          userId
        );
        applyMedicationUpdate({
          ...med,
          reminderEnabled: result.enabled ? 1 : 0,
          reminderTimes: JSON.stringify(result.times),
          reminderNotificationIds: result.reminderNotificationIds,
        });
      } else {
        const cancelled = await cancelMedicationReminder(med, userId);
        if (!cancelled) {
          Alert.alert(
            "Reminder Error",
            "Some scheduled notifications could not be cancelled yet. Please try again."
          );
          return;
        }
        applyMedicationUpdate({
          ...med,
          reminderEnabled: 0,
          reminderNotificationIds: "[]",
        });
      }
    } catch (err: any) {
      Alert.alert("Reminder Error", err.message || "Failed to update reminder.");
    } finally {
      setReminderBusyId(null);
      setPendingReminder(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color={colors.hairline} />
        <Text style={styles.notFoundText}>Patient not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.notFoundBtn}>
          <Text style={styles.notFoundBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Section 1: Header / Details — white */}
        <View style={styles.headerSection}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>{patient.name}</Text>
              <Text style={styles.headerSubtitle}>Patient Folder</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/scanner", params: { patientId: String(patient.id) } })}
              style={styles.scanBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="document-scanner" size={18} color={colors.white} />
              <Text style={styles.scanBtnText}>Scan</Text>
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
              <MaterialIcons name="person" size={26} color={colors.primary} />
            </View>
          </View>
        </View>

        {/* Section 2: Medications Grid — parchment */}
        <View style={styles.medSection}>
          <Text style={styles.sectionTitle}>Medications</Text>
          {visibleMeds.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="local-hospital" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>No medications yet.</Text>
              </View>
            </Card>
          ) : (
            <>
              <Text style={styles.medSectionHint}>
                Tap a medicine for details & reminders
              </Text>
              <View style={styles.medGrid}>
                {visibleMeds.map((med) => {
                  const times = parseReminderTimes(med.reminderTimes);
                  const on = med.reminderEnabled === 1;
                  return (
                    <TouchableOpacity
                      key={String(med.id)}
                      activeOpacity={0.8}
                      onPress={() => setSelectedMed(med)}
                      style={styles.medGridCard}
                    >
                      <View style={styles.medGridIcon}>
                        <MaterialIcons name="local-hospital" size={22} color={colors.primary} />
                      </View>
                      <Text style={styles.medGridName} numberOfLines={2}>
                        {med.name}
                      </Text>
                      <Text style={styles.medGridMeta} numberOfLines={1}>
                        {[med.dosage, med.frequency].filter(Boolean).join(" · ") || "—"}
                      </Text>
                      <View
                        style={[
                          styles.reminderPill,
                          on ? styles.reminderPillOn : styles.reminderPillOff,
                        ]}
                      >
                        <MaterialIcons
                          name={on ? "notifications-active" : "notifications-none"}
                          size={13}
                          color={on ? colors.success : colors.inkTertiary}
                        />
                        <Text
                          style={[
                            styles.reminderPillText,
                            on ? styles.reminderPillTextOn : styles.reminderPillTextOff,
                          ]}
                          numberOfLines={1}
                        >
                          {on ? formatReminderTimes(times) : "No reminder"}
                        </Text>
                      </View>
                      <View style={styles.medGridFooter}>
                        <Text style={styles.medGridDetails}>Details</Text>
                        <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Section 3: Documents Grid — white */}
        <View style={styles.docSection}>
          <Text style={styles.sectionTitle}>Scanned Documents</Text>
          {documents.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="insert-drive-file" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>
                  No documents yet.{"\n"}Tap &quot;Scan&quot; above to save a document here.
                </Text>
              </View>
            </Card>
          ) : (
            <View style={styles.docGrid}>
              {documents.map((doc) => (
                <TouchableOpacity
                  key={String(doc.id)}
                  activeOpacity={0.8}
                  style={styles.docCard}
                  onPress={() => router.push({ pathname: "/document/[id]" as any, params: { id: String(doc.id) } })}
                >
                  <View style={styles.docImageWrap}>
                    <View style={styles.docImageInner}>
                      <Image
                        source={{ uri: doc.imageUri }}
                        style={styles.docImage}
                        resizeMode="cover"
                      />
                      <View style={styles.docOverlay}>
                        <Text style={styles.docDate}>
                          {new Date(doc.dateAdded).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Medication Details Modal */}
      <Modal
        visible={selectedMed !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMed(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailMedIcon}>
                <MaterialIcons name="local-hospital" size={24} color={colors.primary} />
              </View>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailTitle}>{selectedMed?.name}</Text>
                <Text style={styles.detailSubtitle}>
                  {[selectedMed?.dosage, selectedMed?.frequency]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedMed(null)}
                style={styles.detailClose}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={22} color={colors.inkTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {selectedMed?.dosage ? (
                <DetailRow icon="speed" label="Dosage" value={selectedMed.dosage} />
              ) : null}
              {selectedMed?.frequency ? (
                <DetailRow
                  icon="schedule"
                  label="Frequency"
                  value={selectedMed.frequency}
                />
              ) : null}
              {selectedMed?.instructions ? (
                <DetailRow
                  icon="info-outline"
                  label="Instructions"
                  value={selectedMed.instructions}
                />
              ) : null}

              <Text style={styles.detailSectionLabel}>Reminders</Text>
              <View style={styles.reminderToggleRow}>
                <View style={styles.reminderToggleText}>
                  <Text style={styles.reminderToggleTitle}>Daily reminder</Text>
                  <Text style={styles.reminderToggleSub}>
                    {selectedMed?.reminderEnabled === 1
                      ? formatReminderTimes(
                          parseReminderTimes(selectedMed.reminderTimes)
                        )
                      : "Reminders are off"}
                  </Text>
                </View>
                <Switch
                  value={
                    pendingReminder && pendingReminder.id === selectedMed?.id
                      ? pendingReminder.enabled
                      : selectedMed?.reminderEnabled === 1
                  }
                  onValueChange={(v) => {
                    if (selectedMed) handleToggleReminder(selectedMed, v);
                  }}
                  disabled={reminderBusyId !== null}
                  trackColor={{ true: colors.primary, false: colors.surfaceTile2 }}
                  thumbColor={colors.white}
                />
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedMed && reminderBusyId === null) setReminderEditor(selectedMed);
                }}
                style={[styles.editTimesBtn, reminderBusyId !== null && { opacity: 0.6 }]}
                disabled={reminderBusyId !== null}
                activeOpacity={0.8}
              >
                <MaterialIcons name="alarm-add" size={20} color={colors.primary} />
                <Text style={styles.editTimesBtnText}>
                  Set custom reminder times
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSelectedMed(null)}
              style={styles.detailDoneBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.detailDoneText}>Done</Text>
            </TouchableOpacity>
          </GlassPanel>
        </View>
      </Modal>

      {/* Reminder Settings Modal */}
      <ReminderSettingsModal
        medication={reminderEditor}
        onClose={() => setReminderEditor(null)}
        onSaved={handleReminderSaved}
      />
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>
        <MaterialIcons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.detailRowText}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  notFoundText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.inkTertiary,
  },
  notFoundBtn: {
    marginTop: 16,
  },
  notFoundBtnText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: "600",
    fontFamily: fonts.semibold,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    backgroundColor: colors.canvas,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: -0.374,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 10,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  medSection: {
    backgroundColor: colors.canvasParchment,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  docSection: {
    backgroundColor: colors.canvas,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
    marginBottom: 12,
  },
  medSectionHint: {
    fontSize: 13,
    color: colors.inkTertiary,
    marginTop: -6,
    marginBottom: 14,
  },
  medGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  medGridCard: {
    width: "48%",
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    alignItems: "center",
  },
  medGridIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  medGridName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 19,
    fontFamily: fonts.semibold,
    minHeight: 38,
  },
  medGridMeta: {
    fontSize: 12,
    color: colors.inkTertiary,
    marginTop: 4,
    textAlign: "center",
  },
  reminderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
    maxWidth: "100%",
  },
  reminderPillOn: {
    backgroundColor: colors.successSoft,
  },
  reminderPillOff: {
    backgroundColor: colors.surfacePearl,
  },
  reminderPillText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
    fontFamily: fonts.semibold,
  },
  reminderPillTextOn: {
    color: colors.success,
  },
  reminderPillTextOff: {
    color: colors.inkTertiary,
  },
  medGridFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 12,
  },
  medGridDetails: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  docGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  docCard: {
    width: "47%",
  },
  docImageWrap: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfacePearl,
    ...IMAGE_SHADOW,
  },
  docImageInner: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfacePearl,
  },
  docImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.lg,
  },
  docOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  docDate: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    maxHeight: "85%",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  detailMedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderText: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    letterSpacing: -0.374,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  detailSubtitle: {
    fontSize: 13,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  detailClose: {
    padding: 4,
  },
  detailScroll: {
    flexGrow: 0,
    maxHeight: 320,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  detailRowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  detailRowText: {
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
  },
  detailRowValue: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.semibold,
    marginTop: 12,
    marginBottom: 8,
  },
  reminderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfacePearl,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  reminderToggleText: {
    flex: 1,
  },
  reminderToggleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  reminderToggleSub: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  editTimesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
  },
  editTimesBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  detailDoneBtn: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 12,
  },
  detailDoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  emptyCard: {
    alignItems: "center",
    marginBottom: 8,
  },
  emptyInner: {
    alignItems: "center",
    paddingVertical: 16,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSecondary,
    textAlign: "center",
  },
});
