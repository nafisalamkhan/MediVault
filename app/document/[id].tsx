import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, GlassPanel } from "@/components/ui";
import { colors, radius, fonts } from "@/lib/theme";
import {
  initializeDatabase,
  getDocumentById,
  getPatientById,
  getAllPatients,
  getMedicationsByPatient,
  deleteDocument,
  updateDocumentTitle,
  moveDocument,
  copyDocument,
} from "@/lib/db";
import type {
  Document,
  Patient,
  Medication,
  PrescriptionAnalysis,
} from "@/lib/db/schema";
import {
  filterCombinedMedicines,
  hasGeminiKey,
  normalizeMedicineName,
} from "@/lib/ai";
import { processPrescription } from "@/lib/prescription";
import {
  parseReminderTimes,
  deriveReminderTimes,
  scheduleMedicationReminder,
  cancelMedicationReminder,
  formatReminderTimes,
} from "@/lib/notifications";
import ReminderSettingsModal from "@/components/ReminderSettingsModal";

type ModalType = null | "edit" | "move" | "copy" | "delete";

export default function DocumentViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editTitle, setEditTitle] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [reminderBusyId, setReminderBusyId] = useState<number | null>(null);
  const [pendingReminder, setPendingReminder] = useState<{
    id: number;
    enabled: boolean;
  } | null>(null);
  const [reminderEditor, setReminderEditor] = useState<Medication | null>(null);

  const docId = Number(id);

  const analysis = useMemo<PrescriptionAnalysis | null>(() => {
    if (!document?.analysis) return null;
    try {
      return JSON.parse(document.analysis) as PrescriptionAnalysis;
    } catch {
      return null;
    }
  }, [document]);

  const medicineRows = useMemo(() => {
    // The "Medicines & Reminders" list belongs to THIS document, so it is built
    // from the document's own analysis and never leaks medicines that came from
    // other scans in the same patient folder. Each row is joined to the matching
    // patient-level DB medication (by normalized name) so the reminder toggle
    // still controls the real persisted row.
    const meds = analysis?.medicines ?? [];
    if (meds.length === 0) return [];

    const dbByName = new Map<string, Medication>();
    for (const m of filterCombinedMedicines(medications)) {
      const key = normalizeMedicineName(m.name);
      if (key && !dbByName.has(key)) dbByName.set(key, m);
    }

    const seen = new Set<string>();
    const rows: {
      medicine: {
        name: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
      };
      dbMed: Medication | null;
    }[] = [];
    for (const m of meds) {
      const name = (m.name || "").trim();
      if (!name) continue;
      const key = normalizeMedicineName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        medicine: {
          name,
          dosage: m.dosage || undefined,
          frequency: m.frequency || undefined,
          duration: m.duration || undefined,
          instructions: m.instructions || undefined,
        },
        dbMed: dbByName.get(key) ?? null,
      });
    }
    return rows;
  }, [medications, analysis]);

  async function fetchData(uid: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await initializeDatabase();
      const doc = await getDocumentById(docId, uid);
      setDocument(doc);

      if (doc) {
        const [p, allPts, meds] = await Promise.all([
          getPatientById(doc.patientId, uid),
          getAllPatients(uid),
          getMedicationsByPatient(doc.patientId, uid),
        ]);
        setPatient(p);
        setPatients(allPts.filter((pt) => pt.id !== doc.patientId));
        setMedications(meds);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load document.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!userId || !docId) return;
      fetchData(userId);
    }, [userId, docId]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRefresh() {
    if (userId) fetchData(userId, true);
  }

  function handleDelete() {
    setActiveModal("delete");
  }

  function confirmDelete() {
    if (!userId || !document) return;
    setActionLoading(true);
    deleteDocument(document.id, userId)
      .then(() => {
        showToast("Document deleted", "success");
        router.back();
      })
      .catch((err: any) => {
        Alert.alert("Error", err.message || "Failed to delete.");
      })
      .finally(() => {
        setActionLoading(false);
        setActiveModal(null);
      });
  }

  function handleEdit() {
    if (document) setEditTitle(document.title);
    setActiveModal("edit");
  }

  function confirmEdit() {
    if (!userId || !document || !editTitle.trim()) return;
    setActionLoading(true);
    updateDocumentTitle(document.id, userId, editTitle.trim())
      .then(() => {
        setDocument((prev) =>
          prev ? { ...prev, title: editTitle.trim() } : prev
        );
        showToast("Title updated", "success");
      })
      .catch((err: any) => {
        Alert.alert("Error", err.message || "Failed to rename.");
      })
      .finally(() => {
        setActionLoading(false);
        setActiveModal(null);
      });
  }

  function handleMove() {
    setActiveModal("move");
  }

  function confirmMove(targetPatient: Patient) {
    if (!userId || !document) return;
    setActionLoading(true);
    moveDocument(document.id, userId, targetPatient.id)
      .then(() => {
        setDocument((prev) =>
          prev ? { ...prev, patientId: targetPatient.id } : prev
        );
        setPatient(targetPatient);
        showToast(`Moved to ${targetPatient.name}`, "success");
      })
      .catch((err: any) => {
        Alert.alert("Error", err.message || "Failed to move.");
      })
      .finally(() => {
        setActionLoading(false);
        setActiveModal(null);
      });
  }

  function handleCopy() {
    setActiveModal("copy");
  }

  function confirmCopy(targetPatient: Patient) {
    if (!userId || !document) return;
    setActionLoading(true);
    copyDocument(document.id, userId, targetPatient.id)
      .then(() => {
        showToast(`Copied to ${targetPatient.name}`, "success");
      })
      .catch((err: any) => {
        Alert.alert("Error", err.message || "Failed to copy.");
      })
      .finally(() => {
        setActionLoading(false);
        setActiveModal(null);
      });
  }

  function showToast(message: string, type: "success" | "error") {
    Alert.alert(type === "success" ? "Success" : "Error", message);
  }

  async function handleAnalyze() {
    if (!userId || !document || analyzing) return;
    setAnalyzing(true);
    try {
      const analysis = await processPrescription({
        docId: document.id,
        patientId: document.patientId,
        ownerId: userId,
        text: "",
        imageUri: document.imageUri,
      });
      if (analysis) {
        setDocument((prev) =>
          prev ? { ...prev, analysis: JSON.stringify(analysis) } : prev
        );
        const meds = await getMedicationsByPatient(document.patientId, userId);
        setMedications(meds);
        showToast("AI explanation and reminders are ready.", "success");
      } else {
        Alert.alert(
          "Analysis Failed",
          "Could not analyze this document. Check your connection and try again."
        );
      }
    } catch (err: any) {
      Alert.alert("Analysis Error", err.message || "Failed to analyze.");
    } finally {
      setAnalyzing(false);
    }
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
        setMedications((prev) =>
          prev.map((m) =>
            m.id === med.id
              ? {
                  ...m,
                  reminderEnabled: result.enabled ? 1 : 0,
                  reminderTimes: JSON.stringify(result.times),
                  reminderNotificationIds: result.reminderNotificationIds,
                }
              : m
          )
        );
      } else {
        const cancelled = await cancelMedicationReminder(med, userId);
        if (!cancelled) {
          Alert.alert(
            "Reminder Error",
            "Some scheduled notifications could not be cancelled yet. Please try again."
          );
          return;
        }
        setMedications((prev) =>
          prev.map((m) =>
            m.id === med.id
              ? { ...m, reminderEnabled: 0, reminderNotificationIds: "[]" }
              : m
          )
        );
      }
    } catch (err: any) {
      Alert.alert("Reminder Error", err.message || "Failed to update reminder.");
    } finally {
      setReminderBusyId(null);
      setPendingReminder(null);
    }
  }

  function openReminderEditor(med: Medication) {
    setReminderEditor(med);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color={colors.hairline} />
        <Text style={styles.notFoundText}>Document not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.notFoundBtn}>
          <Text style={styles.notFoundBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const doctor = analysis?.doctor;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Image */}
        <View style={styles.imageCard}>
          <Image
            source={{ uri: document.imageUri }}
            style={styles.documentImage}
            resizeMode="contain"
          />
        </View>

        {/* Info Bar */}
        <View style={styles.infoBar}>
          <View style={styles.infoItem}>
            <MaterialIcons name="calendar-today" size={14} color={colors.inkTertiary} />
            <Text style={styles.infoText}>
              {new Date(document.dateAdded).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          {patient && (
            <View style={styles.infoItem}>
              <MaterialIcons name="person" size={14} color={colors.inkTertiary} />
              <Text style={styles.infoText}>{patient.name}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconEdit]}>
              <MaterialIcons name="edit" size={18} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <MaterialIcons name="delete" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconSuccess]}>
              <MaterialIcons name="content-copy" size={18} color={colors.success} />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelSuccess]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMove} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconMove]}>
              <MaterialIcons name="drive-file-move" size={18} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Move</Text>
          </TouchableOpacity>
        </View>

        {/* AI Explanation */}
        {analysis ? (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
              <Text style={styles.textTitle}>AI Explanation</Text>
              {hasGeminiKey() && (
                <TouchableOpacity
                  onPress={handleAnalyze}
                  disabled={analyzing}
                  style={styles.reanalyzeBtn}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="refresh" size={14} color={colors.primary} />
                  <Text style={styles.reanalyzeText}>
                    {analyzing ? "Analyzing..." : "Re-analyze"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.sectionBody}>
              <Text style={styles.summaryText}>
                {analysis.summary || "No summary available for this document."}
              </Text>
              {(analysis.diagnosis ||
                analysis.date ||
                analysis.hospital ||
                analysis.patientName) && (
                <View style={styles.chipRow}>
                  {analysis.diagnosis ? (
                    <Chip label="Diagnosis" value={analysis.diagnosis} />
                  ) : null}
                  {analysis.date ? <Chip label="Date" value={analysis.date} /> : null}
                  {analysis.hospital ? (
                    <Chip label="Hospital" value={analysis.hospital} />
                  ) : null}
                  {analysis.patientName ? (
                    <Chip label="Patient" value={analysis.patientName} />
                  ) : null}
                </View>
              )}
            </View>
          </View>
        ) : hasGeminiKey() ? (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
              <Text style={styles.textTitle}>AI Explanation</Text>
            </View>
            <View style={styles.sectionBody}>
              <Text style={styles.analyzeDesc}>
                Let AI explain this prescription, extract the doctor details, and
                set up medication reminders.
              </Text>
              <TouchableOpacity
                onPress={handleAnalyze}
                style={[styles.analyzeBtn, analyzing && { opacity: 0.6 }]}
                disabled={analyzing}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialIcons name="auto-awesome" size={18} color={colors.white} />
                )}
                <Text style={styles.analyzeBtnText}>
                  {analyzing ? "Analyzing..." : "Analyze with AI"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Doctor */}
        {analysis && (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="medical-services" size={20} color={colors.primary} />
              <Text style={styles.textTitle}>Doctor</Text>
            </View>
            <View style={styles.sectionBody}>
              {doctor?.name ? <InfoRow icon="person" value={doctor.name} /> : null}
              {doctor?.specialty ? (
                <InfoRow icon="work" value={doctor.specialty} />
              ) : null}
              {doctor?.contact ? (
                <InfoRow icon="phone" value={doctor.contact} />
              ) : null}
              {doctor?.address ? (
                <InfoRow icon="place" value={doctor.address} />
              ) : null}
              {!doctor?.name &&
              !doctor?.specialty &&
              !doctor?.contact &&
              !doctor?.address ? (
                <Text style={styles.analyzeDesc}>
                  No doctor details extracted yet. Tap &quot;Re-analyze&quot; to
                  try again.
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Medicines & Reminders */}
        {medicineRows.length > 0 && (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="local-hospital" size={20} color={colors.primary} />
              <Text style={styles.textTitle}>Medicines & Reminders</Text>
            </View>
            <View style={styles.sectionBody}>
              {medicineRows.map(({ medicine, dbMed }, idx) => (
                <View
                  key={idx}
                  style={[styles.medCard, idx > 0 && styles.medCardBorder]}
                >
                  <View style={styles.medInfo}>
                    <Text
                      style={styles.medName}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {medicine.name}
                    </Text>
                    {medicine.dosage || medicine.frequency ? (
                      <Text
                        style={styles.medMeta}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {[medicine.dosage, medicine.frequency]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                    {medicine.duration ? (
                      <Text
                        style={styles.medMeta}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        Duration: {medicine.duration}
                      </Text>
                    ) : null}
                    {medicine.instructions ? (
                      <Text
                        style={styles.medInstructions}
                        numberOfLines={3}
                        ellipsizeMode="tail"
                      >
                        {medicine.instructions}
                      </Text>
                    ) : null}
                    {dbMed?.reminderEnabled === 1 ? (
                      <Text style={styles.reminderStatus}>
                        {formatReminderTimes(parseReminderTimes(dbMed.reminderTimes))}
                      </Text>
                    ) : null}
                  </View>
                  {dbMed ? (
                    <View style={styles.medActions}>
                      <TouchableOpacity
                        onPress={() => openReminderEditor(dbMed)}
                        style={[styles.timeEditBtn, reminderBusyId !== null && { opacity: 0.6 }]}
                        disabled={reminderBusyId !== null}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="alarm-add" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <Switch
                        value={
                          pendingReminder && pendingReminder.id === dbMed.id
                            ? pendingReminder.enabled
                            : dbMed.reminderEnabled === 1
                        }
                        onValueChange={(v) => handleToggleReminder(dbMed, v)}
                        disabled={reminderBusyId !== null}
                        trackColor={{ true: colors.primary, false: colors.surfaceTile2 }}
                        thumbColor={colors.white}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.inkMuted80} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Title Modal */}
      <Modal
        visible={activeModal === "edit"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Document</Text>
            <TextInput
              style={styles.textInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Document title"
              placeholderTextColor={colors.inkTertiary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmEdit}
                style={[styles.modalConfirmBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading || !editTitle.trim()}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={activeModal === "delete"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <View style={styles.dangerIconWrap}>
              <View style={styles.dangerIcon}>
                <MaterialIcons name="warning" size={28} color={colors.danger} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Delete Document</Text>
            <Text style={styles.modalDesc}>
              This action cannot be undone. The image file will also be removed.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[styles.modalDeleteBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      </Modal>

      {/* Move/Copy Patient Picker Modal */}
      <Modal
        visible={activeModal === "move" || activeModal === "copy"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeModal === "move" ? "Move to Patient" : "Copy to Patient"}
            </Text>
            <Text style={styles.modalDesc}>
              {activeModal === "move"
                ? "Select a patient folder to move this document to."
                : "Select a patient folder to copy this document to."}
            </Text>
            {patients.length === 0 ? (
              <View style={styles.emptyPicker}>
                <MaterialIcons name="folder-open" size={36} color={colors.hairline} />
                <Text style={styles.emptyPickerText}>
                  No other patients available.
                </Text>
              </View>
            ) : (
              <FlatList
                data={patients}
                keyExtractor={(item) => String(item.id)}
                style={styles.patientList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() =>
                      activeModal === "move"
                        ? confirmMove(item)
                        : confirmCopy(item)
                    }
                    style={styles.patientRow}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.patientAvatar}>
                      <MaterialIcons name="person" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.patientName}>{item.name}</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={18}
                      color={colors.hairline}
                    />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={styles.modalCancelBtnFull}
              disabled={actionLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassPanel>
        </View>
      </Modal>

      {/* Reminder Settings Modal */}
      <ReminderSettingsModal
        medication={reminderEditor}
        onClose={() => setReminderEditor(null)}
        onSaved={(updated) => {
          setMedications((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasParchment,
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
    paddingBottom: 100,
  },
  imageCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  documentImage: {
    width: "100%",
    height: 320,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
  },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  infoText: {
    fontSize: 13,
    color: colors.inkSecondary,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconEdit: {
    backgroundColor: colors.primarySoft,
  },
  actionIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  actionIconSuccess: {
    backgroundColor: colors.successSoft,
  },
  actionIconMove: {
    backgroundColor: colors.primarySoft,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionLabelSuccess: {
    color: colors.success,
  },
  textSection: {
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    overflow: "hidden",
  },
  textHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dividerSoft,
  },
  textTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  reanalyzeBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reanalyzeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  sectionBody: {
    padding: 16,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted80,
  },
  analyzeDesc: {
    fontSize: 14,
    color: colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 14,
  },
  analyzeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  infoRowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    flex: 1,
    fontSize: 14,
    color: colors.inkMuted80,
    lineHeight: 20,
  },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  medCardBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dividerSoft,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  medMeta: {
    fontSize: 13,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: colors.inkTertiary,
    marginTop: 4,
    fontStyle: "italic",
  },
  reminderStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
    marginTop: 6,
    fontFamily: fonts.semibold,
  },
  medActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: "rgba(245, 245, 247, 0.95)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineRgba,
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
    paddingVertical: 14,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkMuted80,
    fontFamily: fonts.semibold,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    marginBottom: 4,
    letterSpacing: -0.374,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.inkTertiary,
    marginBottom: 16,
  },
  dangerIconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  dangerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.canvas,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  modalDeleteBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  modalCancelBtnFull: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
  },
  emptyPicker: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyPickerText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.inkTertiary,
    textAlign: "center",
  },
  patientList: {
    maxHeight: 260,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 4,
    backgroundColor: colors.surfacePearl,
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  patientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.ink,
    fontFamily: fonts.medium,
  },
});

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>
        <MaterialIcons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.infoRowText}>{value}</Text>
    </View>
  );
}
