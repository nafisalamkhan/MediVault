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
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, Typography, Button, Input } from "@/components/ui";
import { colors, radius, typography, spacing, shadows } from "@/lib/theme";
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
import { useToast } from "@/components/Toast";

type ModalType = null | "edit" | "move" | "copy" | "delete";

export default function DocumentViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToast();

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
    const meds = analysis?.medicines ?? [];
    if (meds.length === 0) return [];

    const dbByName = new Map<string, Medication>();
    for (const m of medications) {
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
    }, [userId, docId])
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
        <MaterialIcons name="error-outline" size={40} color={colors.inkMuted} />
        <Typography variant="body" style={styles.notFoundText}>Document not found</Typography>
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
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
        {/* Document Image */}
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
            <MaterialIcons name="calendar-today" size={12} color={colors.inkMuted} />
            <Typography variant="caption" style={styles.infoText}>
              {new Date(document.dateAdded).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
          </View>
          {patient && (
            <View style={styles.infoItem}>
              <MaterialIcons name="person" size={12} color={colors.inkMuted} />
              <Typography variant="caption" style={styles.infoText}>{patient.name}</Typography>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionBtn} activeOpacity={0.7}>
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn} activeOpacity={0.7}>
            <MaterialIcons name="delete" size={18} color={colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.actionBtn} activeOpacity={0.7}>
            <MaterialIcons name="content-copy" size={18} color={colors.success} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMove} style={styles.actionBtn} activeOpacity={0.7}>
            <MaterialIcons name="drive-file-move" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* AI Explanation */}
        {analysis ? (
          <Card style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <Typography variant="title" style={styles.aiTitle}>AI Explanation</Typography>
              {hasGeminiKey() && (
                <Button
                  title={analyzing ? "Analyzing..." : "Re-analyze"}
                  variant="outline"
                  onPress={handleAnalyze}
                  disabled={analyzing}
                  style={styles.reanalyzeBtn}
                />
              )}
            </View>
            <View style={styles.aiBody}>
              <Typography variant="body" style={styles.aiSummary}>
                {analysis.summary || "No summary available for this document."}
              </Typography>
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
          </Card>
        ) : hasGeminiKey() ? (
          <Card style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <Typography variant="title" style={styles.textTitle}>AI Explanation</Typography>
            </View>
            <View style={styles.sectionBody}>
              <Typography variant="body" style={styles.analyzeDesc}>
                Let AI explain this prescription, extract the doctor details, and
                set up medication reminders.
              </Typography>
              <Button
                title={analyzing ? "Analyzing..." : "Analyze with AI"}
                variant="primary"
                onPress={handleAnalyze}
                disabled={analyzing}
                loading={analyzing}
              />
            </View>
          </Card>
        ) : null}

        {/* Doctor */}
        {analysis && (
          <Card style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="medical-services" size={18} color={colors.primary} />
              <Typography variant="title" style={styles.textTitle}>Doctor</Typography>
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
                <Typography variant="body" style={styles.analyzeDesc}>
                  No doctor details extracted yet. Tap &lsquo;Re-analyze&rsquo; to
                  try again.
                </Typography>
              ) : null}
            </View>
          </Card>
        )}

        {/* Medicines & Reminders */}
        {medicineRows.length > 0 && (
          <Card style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="local-hospital" size={18} color={colors.primary} />
              <Typography variant="title" style={styles.textTitle}>Medicines & Reminders</Typography>
            </View>
            <View style={styles.sectionBody}>
              {medicineRows.map(({ medicine, dbMed }, idx) => (
                <View
                  key={idx}
                  style={[styles.medCard, idx > 0 && styles.medCardBorder]}
                >
                  <View style={styles.medInfo}>
                    <Typography variant="body" style={styles.medName} numberOfLines={2}>
                      {medicine.name}
                    </Typography>
                    {medicine.dosage || medicine.frequency ? (
                      <Typography variant="caption" style={styles.medMeta} numberOfLines={2}>
                        {[medicine.dosage, medicine.frequency]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
                    ) : null}
                    {medicine.duration ? (
                      <Typography variant="caption" style={styles.medMeta} numberOfLines={2}>
                        Duration: {medicine.duration}
                      </Typography>
                    ) : null}
                    {medicine.instructions ? (
                      <Typography variant="caption" style={styles.medInstructions} numberOfLines={3}>
                        {medicine.instructions}
                      </Typography>
                    ) : null}
                    {dbMed?.reminderEnabled === 1 ? (
                      <Typography variant="caption" style={styles.reminderStatus}>
                        {formatReminderTimes(parseReminderTimes(dbMed.reminderTimes))}
                      </Typography>
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
                        <MaterialIcons name="alarm-add" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <Switch
                        value={
                          pendingReminder && pendingReminder.id === dbMed.id
                            ? pendingReminder.enabled
                            : dbMed.reminderEnabled === 1
                        }
                        onValueChange={(v) => handleToggleReminder(dbMed, v)}
                        disabled={reminderBusyId !== null}
                        trackColor={{ true: colors.primary, false: colors.hairline }}
                        thumbColor={colors.white}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        )}

      </ScrollView>

      {/* Edit Title Modal */}
      <Modal
        visible={activeModal === "edit"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>Rename Document</Typography>
            <Input
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Document title"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setActiveModal(null)} />
              <Button
                title="Save"
                variant="primary"
                onPress={confirmEdit}
                disabled={actionLoading || !editTitle.trim()}
                loading={actionLoading}
              />
            </View>
          </Card>
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
          <Card style={styles.modalCard}>
            <View style={styles.dangerIconWrap}>
              <View style={styles.dangerIcon}>
                <MaterialIcons name="warning" size={24} color={colors.danger} />
              </View>
            </View>
            <Typography variant="heading3" style={styles.modalTitle}>Delete Document</Typography>
            <Typography variant="body" style={styles.modalDesc}>
              This action cannot be undone. The image file will also be removed.
            </Typography>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setActiveModal(null)} />
              <Button
                title="Delete"
                variant="danger"
                onPress={confirmDelete}
                disabled={actionLoading}
                loading={actionLoading}
              />
            </View>
          </Card>
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
          <Card style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>
              {activeModal === "move" ? "Move to Patient" : "Copy to Patient"}
            </Typography>
            <Typography variant="body" style={styles.modalDesc}>
              {activeModal === "move"
                ? "Select a patient folder to move this document to."
                : "Select a patient folder to copy this document to."}
            </Typography>
            {patients.length === 0 ? (
              <View style={styles.emptyPicker}>
                <MaterialIcons name="folder-open" size={32} color={colors.inkMuted} />
                <Typography variant="body" style={styles.emptyPickerText}>
                  No other patients available.
                </Typography>
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
                      <MaterialIcons name="person" size={18} color={colors.primary} />
                    </View>
                    <Typography variant="body" style={styles.patientName}>{item.name}</Typography>
                    <MaterialIcons
                      name="chevron-right"
                      size={16}
                      color={colors.hairline}
                    />
                  </TouchableOpacity>
                )}
              />
            )}
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setActiveModal(null)}
              disabled={actionLoading}
              style={styles.modalCancelBtnFull}
            />
          </Card>
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
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  notFoundText: {
    marginTop: spacing.md,
    color: colors.inkMuted,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
  },
  imageCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  documentImage: {
    width: "100%",
    height: 280,
    backgroundColor: colors.surface,
  },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  infoText: {
    flexShrink: 1,
    color: colors.inkSecondary,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card,
  },
  actionBtn: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  aiCard: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  aiTitle: {
    color: colors.primary,
    fontWeight: "700",
  },
  reanalyzeBtn: {
    marginLeft: "auto",
  },
  aiBody: {
    padding: spacing.lg,
  },
  aiSummary: {
    color: colors.ink,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.white,
  },
  chipValue: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.white,
  },
  sectionBody: {
    padding: spacing.lg,
  },
  textSection: {
    marginTop: spacing.md,
    borderRadius: radius.xl,
    ...shadows.card,
  },
  textHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  textTitle: {
    color: colors.ink,
    fontWeight: "700",
  },
  analyzeDesc: {
    color: colors.inkSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoRowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    flex: 1,
    color: colors.inkSecondary,
    lineHeight: 20,
  },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  medCardBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    color: colors.ink,
    fontWeight: "600",
  },
  medMeta: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  medInstructions: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontStyle: "italic",
  },
  reminderStatus: {
    marginTop: spacing.xs,
    fontWeight: "600",
    color: colors.success,
  },
  medActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timeEditBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    marginBottom: spacing.xs,
  },
  modalDesc: {
    marginBottom: spacing.lg,
    color: colors.inkSecondary,
  },
  dangerIconWrap: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  dangerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalCancelBtnFull: {
    marginTop: spacing.md,
  },
  emptyPicker: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyPickerText: {
    marginTop: spacing.md,
    color: colors.inkMuted,
    textAlign: "center",
  },
  patientList: {
    maxHeight: 220,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  patientAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  patientName: {
    flex: 1,
    color: colors.ink,
  },
});

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Typography variant="caption" style={styles.chipLabel}>{label}</Typography>
      <Typography variant="caption" style={styles.chipValue}>{value}</Typography>
    </View>
  );
}

function InfoRow({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>
        <MaterialIcons name={icon} size={14} color={colors.primary} />
      </View>
      <Typography variant="body" style={styles.infoRowText}>{value}</Typography>
    </View>
  );
}