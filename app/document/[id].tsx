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
import { Card, GlassPanel, Text, Typography, Button, Input } from "@/components/ui";
import { colors, radius, typography, spacing } from "@/lib/theme";
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
        <MaterialIcons name="error-outline" size={48} color={colors.hairline} />
        <Typography variant="bodyMd" style={styles.notFoundText}>Document not found</Typography>
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
            <MaterialIcons name="calendar-today" size={14} color={colors.inkMuted} />
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
              <MaterialIcons name="person" size={14} color={colors.inkMuted} />
              <Typography variant="caption" style={styles.infoText}>{patient.name}</Typography>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconEdit]}>
              <MaterialIcons name="edit" size={18} color={colors.primary} />
            </View>
            <Typography variant="caption" style={styles.actionLabel}>Edit</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <MaterialIcons name="delete" size={18} color={colors.danger} />
            </View>
            <Typography variant="caption" style={[styles.actionLabel, styles.actionLabelDanger]}>Delete</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconSuccess]}>
              <MaterialIcons name="content-copy" size={18} color={colors.success} />
            </View>
            <Typography variant="caption" style={[styles.actionLabel, styles.actionLabelSuccess]}>Copy</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMove} style={styles.actionBtn} activeOpacity={0.7}>
            <View style={[styles.actionIcon, styles.actionIconMove]}>
              <MaterialIcons name="drive-file-move" size={18} color={colors.primary} />
            </View>
            <Typography variant="caption" style={styles.actionLabel}>Move</Typography>
          </TouchableOpacity>
        </View>

        {/* AI Explanation */}
        {analysis ? (
          <Card style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
              <Typography variant="heading3" style={styles.textTitle}>AI Explanation</Typography>
              {hasGeminiKey() && (
                <Button
                  title={analyzing ? "Analyzing..." : "Re-analyze"}
                  variant="utility"
                  onPress={handleAnalyze}
                  disabled={analyzing}
                  style={styles.reanalyzeBtn}
                />
              )}
            </View>
            <View style={styles.sectionBody}>
              <Typography variant="bodyMd" style={styles.summaryText}>
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
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
              <Typography variant="heading3" style={styles.textTitle}>AI Explanation</Typography>
            </View>
            <View style={styles.sectionBody}>
              <Typography variant="bodyMd" style={styles.analyzeDesc}>
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
              <MaterialIcons name="medical-services" size={20} color={colors.primary} />
              <Typography variant="heading3" style={styles.textTitle}>Doctor</Typography>
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
<Typography variant="bodyMd" style={styles.analyzeDesc}>
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
              <MaterialIcons name="local-hospital" size={20} color={colors.primary} />
              <Typography variant="heading3" style={styles.textTitle}>Medicines & Reminders</Typography>
            </View>
            <View style={styles.sectionBody}>
              {medicineRows.map(({ medicine, dbMed }, idx) => (
                <View
                  key={idx}
                  style={[styles.medCard, idx > 0 && styles.medCardBorder]}
                >
                  <View style={styles.medInfo}>
                    <Typography variant="bodyMd" style={styles.medName} numberOfLines={2}>
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
      <View style={styles.bottomBar}>
        <Button
          title="Back"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.backBtn}
        />
      </View>

      {/* Edit Title Modal */}
      <Modal
        visible={activeModal === "edit"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassPanel variant="elevated" style={styles.modalCard}>
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
          <GlassPanel variant="elevated" style={styles.modalCard}>
            <View style={styles.dangerIconWrap}>
              <View style={styles.dangerIcon}>
                <MaterialIcons name="warning" size={28} color={colors.danger} />
              </View>
            </View>
            <Typography variant="heading3" style={styles.modalTitle}>Delete Document</Typography>
            <Typography variant="bodyMd" style={styles.modalDesc}>
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
          <GlassPanel variant="elevated" style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>
              {activeModal === "move" ? "Move to Patient" : "Copy to Patient"}
            </Typography>
            <Typography variant="bodyMd" style={styles.modalDesc}>
              {activeModal === "move"
                ? "Select a patient folder to move this document to."
                : "Select a patient folder to copy this document to."}
            </Typography>
            {patients.length === 0 ? (
              <View style={styles.emptyPicker}>
                <MaterialIcons name="folder-open" size={36} color={colors.hairline} />
                <Typography variant="bodyMd" style={styles.emptyPickerText}>
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
                      <MaterialIcons name="person" size={20} color={colors.primary} />
                    </View>
                    <Typography variant="bodyMd" style={styles.patientName}>{item.name}</Typography>
                    <MaterialIcons
                      name="chevron-right"
                      size={18}
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
    backgroundColor: colors.canvasSoft,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasSoft,
  },
  notFoundText: {
    marginTop: spacing.md,
    color: colors.inkMuted,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageCard: {
    marginHorizontal: spacing.xl,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  documentImage: {
    width: "100%",
    height: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
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
    flexShrink: 1,
    color: colors.inkSecondary,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: spacing.xl,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
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
    color: colors.primary,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionLabelSuccess: {
    color: colors.success,
  },
  textSection: {
    marginTop: 12,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  textHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  textTitle: {
    color: colors.ink,
  },
  reanalyzeBtn: {
    marginLeft: "auto",
  },
  sectionBody: {
    padding: 16,
  },
  summaryText: {
    color: colors.inkSecondary,
  },
  analyzeDesc: {
    color: colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
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
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSecondary,
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
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
    color: colors.inkSecondary,
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
    borderTopColor: colors.hairline,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    color: colors.ink,
  },
  medMeta: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  medInstructions: {
    marginTop: 4,
    color: colors.inkMuted,
    fontStyle: "italic",
  },
  reminderStatus: {
    marginTop: 6,
    fontWeight: "600",
    color: colors.success,
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
    paddingHorizontal: spacing.xl,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: "rgba(246, 245, 244, 0.95)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  backBtn: {
    width: "100%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalTitle: {
    marginBottom: 4,
  },
  modalDesc: {
    marginBottom: 16,
    color: colors.inkSecondary,
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalCancelBtnFull: {
    marginTop: 12,
  },
  emptyPicker: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyPickerText: {
    marginTop: 8,
    color: colors.inkMuted,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    color: colors.ink,
  },
});

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Typography variant="eyebrow" style={styles.chipLabel}>{label}</Typography>
      <Typography variant="eyebrow" style={styles.chipValue}>{value}</Typography>
    </View>
  );
}

function InfoRow({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>
        <MaterialIcons name={icon} size={16} color={colors.primary} />
      </View>
      <Typography variant="bodyMd" style={styles.infoRowText}>{value}</Typography>
    </View>
  );
}