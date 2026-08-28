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
import { Card, GlassPanel, Text, Typography, Button } from "@/components/ui";
import ReminderSettingsModal from "@/components/ReminderSettingsModal";
import { colors, radius, typography, spacing, shadows } from "@/lib/theme";
import { useToast } from "@/components/Toast";
import * as DocumentPicker from "expo-document-picker";
import { File, Directory, Paths } from "expo-file-system";
import {
  initializeDatabase,
  getPatientById,
  getMedicationsByPatient,
  getDocumentsByPatient,
  addDocument,
} from "@/lib/db";
import type { Patient, Medication, Document } from "@/lib/db/schema";
import { normalizeMedicineName } from "@/lib/ai";
import {
  parseReminderTimes,
  deriveReminderTimes,
  scheduleMedicationReminder,
  cancelMedicationReminder,
  formatReminderTimes,
} from "@/lib/notifications";

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToast();

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

  const visibleMeds = useMemo(() => {
    const seen = new Set<string>();
    const out: Medication[] = [];
    for (const m of medications) {
      const key = normalizeMedicineName(m.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out;
  }, [medications]);

  const fetchData = useCallback(async (uid: string, isRefresh = false) => {
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
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !patientId) return;
      fetchData(userId);
    }, [userId, patientId, fetchData])
  );

  function handleRefresh() {
    if (userId) fetchData(userId, true);
  }

  async function handleUpload() {
    if (!userId || !patient) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const isPdf = asset.mimeType === "application/pdf" || asset.name?.toLowerCase().endsWith(".pdf");
      await savePickedFile(asset.uri, isPdf ? "pdf" : "image", asset.name);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "Could not open picker.");
    }
  }

  async function savePickedFile(uri: string, kind: "image" | "pdf", originalName?: string) {
    if (!userId || !patient) return;
    try {
      const docsDir = new Directory(Paths.document, "documents");
      if (!docsDir.exists) docsDir.create();
      const ext = kind === "pdf" ? "pdf" : "jpg";
      const filename = `doc_${patient.id}_${Date.now()}.${ext}`;
      const destFile = new File(docsDir, filename);
      const srcFile = new File(uri);
      srcFile.copy(destFile);
      await initializeDatabase();
      const title = originalName || filename;
      const docId = await addDocument({ ownerId: userId, patientId: patient.id, imageUri: destFile.uri, title, extractedText: "" }, userId);
      showToast("Document uploaded", "success");
      fetchData(userId, true);
      router.push(`/document/${docId}` as any);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "Could not save document.");
    }
  }

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
        <Typography variant="bodyMd" style={styles.notFoundText}>Patient not found</Typography>
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
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
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Typography variant="heading2" style={styles.headerTitle} numberOfLines={1}>{patient.name}</Typography>
              <Typography variant="caption" style={styles.headerSubtitle}>Patient Folder</Typography>
            </View>
            <View style={styles.headerAvatar}>
              <MaterialIcons name="person" size={26} color={colors.primary} />
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleUpload}
              style={[styles.scanBtn, styles.uploadBtn]}
              activeOpacity={0.85}
            >
              <MaterialIcons name="upload-file" size={18} color={colors.ink} />
              <Typography variant="button" style={styles.uploadBtnText}>Upload</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/scanner?patientId=${patient.id}` as any)}
              style={styles.scanBtn}
              activeOpacity={0.85}
            >
              <MaterialIcons name="document-scanner" size={18} color={colors.white} />
              <Typography variant="button" style={styles.scanBtnText}>Scan</Typography>
            </TouchableOpacity>
          </View>
        </View>

        {/* Medications */}
        <View style={styles.medSection}>
          <Typography variant="eyebrow" style={styles.sectionTitle}>Medications</Typography>
          {visibleMeds.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="local-hospital" size={28} color={colors.primary} />
                </View>
                <Typography variant="bodyMd" style={styles.emptyText}>No medications yet.</Typography>
              </View>
            </Card>
          ) : (
            <>
              <Typography variant="caption" style={styles.medSectionHint}>
                Tap a medicine for details & reminders
              </Typography>
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
                      <Typography variant="bodyMd" style={styles.medGridName} numberOfLines={2}>
                        {med.name}
                      </Typography>
                      <Typography variant="caption" style={styles.medGridMeta} numberOfLines={1}>
                        {[med.dosage, med.frequency].filter(Boolean).join(" · ") || "—"}
                      </Typography>
                      <View
                        style={[
                          styles.reminderPill,
                          on ? styles.reminderPillOn : styles.reminderPillOff,
                        ]}
                      >
                        <MaterialIcons
                          name={on ? "notifications-active" : "notifications-none"}
                          size={13}
                          color={on ? colors.success : colors.inkFaint}
                        />
                        <Typography
                          variant="caption"
                          style={[
                            styles.reminderPillText,
                            on ? styles.reminderPillTextOn : styles.reminderPillTextOff,
                          ]}
                          numberOfLines={1}
                        >
                          {on ? formatReminderTimes(times) : "No reminder"}
                        </Typography>
                      </View>
                      <View style={styles.medGridFooter}>
                        <Typography variant="caption" style={styles.medGridDetails}>Details</Typography>
                        <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Documents */}
        <View style={styles.docSection}>
          <Typography variant="eyebrow" style={styles.sectionTitle}>Scanned Documents</Typography>
          {documents.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="insert-drive-file" size={28} color={colors.primary} />
                </View>
                <Typography variant="bodyMd" style={styles.emptyText}>
                  No documents yet.{"\n"}Tap &lsquo;Scan&rsquo; above to save a document here.
                </Typography>
              </View>
            </Card>
          ) : (
            <View style={styles.docGrid}>
              {documents.map((doc) => {
                const isPdf = doc.imageUri.toLowerCase().endsWith(".pdf");
                return (
                  <TouchableOpacity
                    key={String(doc.id)}
                    activeOpacity={0.85}
                    style={styles.docCard}
                    onPress={() => router.push(`/document/${doc.id}` as any)}
                  >
                    <View style={styles.docImageWrap}>
                      <View style={styles.docImageInner}>
                        {isPdf ? (
                          <View style={styles.pdfPlaceholder}>
                            <MaterialIcons name="picture-as-pdf" size={48} color={colors.danger} />
                            <Typography variant="caption" style={styles.pdfLabel} numberOfLines={1}>{doc.title || "PDF Document"}</Typography>
                          </View>
                        ) : (
                          <Image
                            source={{ uri: doc.imageUri }}
                            style={styles.docImage}
                            resizeMode="cover"
                          />
                        )}
                        <View style={styles.docOverlay} pointerEvents="none">
                          <Typography variant="caption" style={styles.docDate}>
                            {new Date(doc.dateAdded).toLocaleDateString()}
                          </Typography>
                        </View>
                      </View>
                    </View>
                    <View style={styles.docTitleRow}>
                      <Typography variant="caption" style={styles.docTitle} numberOfLines={1}>{doc.title || (isPdf ? "PDF" : "Image")}</Typography>
                      <MaterialIcons name="open-in-new" size={14} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
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
          <GlassPanel variant="elevated" style={styles.modalCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailMedIcon}>
                <MaterialIcons name="local-hospital" size={24} color={colors.primary} />
              </View>
              <View style={styles.detailHeaderText}>
                <Typography variant="heading3" style={styles.detailTitle}>{selectedMed?.name}</Typography>
                <Typography variant="caption" style={styles.detailSubtitle}>
                  {[selectedMed?.dosage, selectedMed?.frequency]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedMed(null)}
                style={styles.detailClose}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={22} color={colors.inkFaint} />
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

              <Typography variant="eyebrow" style={styles.detailSectionLabel}>Reminders</Typography>
              <View style={styles.reminderToggleRow}>
                <View style={styles.reminderToggleText}>
                  <Typography variant="bodyMd" style={styles.reminderToggleTitle}>Daily reminder</Typography>
                  <Typography variant="caption" style={styles.reminderToggleSub}>
                    {selectedMed?.reminderEnabled === 1
                      ? formatReminderTimes(
                          parseReminderTimes(selectedMed.reminderTimes)
                        )
                      : "Reminders are off"}
                  </Typography>
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
                  trackColor={{ true: colors.primary, false: colors.hairline }}
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
                <Typography variant="button" style={styles.editTimesBtnText}>
                  Set custom reminder times
                </Typography>
              </TouchableOpacity>
            </ScrollView>

            <Button
              title="Done"
              variant="primary"
              onPress={() => setSelectedMed(null)}
              style={styles.detailDoneBtn}
            />
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
        <Typography variant="eyebrow" style={styles.detailRowLabel}>{label}</Typography>
        <Typography variant="bodyMd" style={styles.detailRowValue}>{value}</Typography>
      </View>
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
    paddingBottom: 40,
  },
  headerSection: {
    backgroundColor: colors.canvasSoft,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 110,
    ...shadows.card,
  },
  scanBtnText: {
    color: colors.white,
  },
  uploadBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  uploadBtnText: {
    color: colors.ink,
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
    backgroundColor: colors.canvasSoft,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: spacing.xl,
  },
  docSection: {
    backgroundColor: colors.canvasSoft,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    color: colors.inkMuted,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  medSectionHint: {
    color: colors.inkMuted,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    color: colors.ink,
    textAlign: "center",
    minHeight: 38,
  },
  medGridMeta: {
    marginTop: 4,
    textAlign: "center",
    color: colors.inkMuted,
  },
  reminderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
    maxWidth: "100%",
  },
  reminderPillOn: {
    backgroundColor: colors.successSoft,
  },
  reminderPillOff: {
    backgroundColor: colors.surface,
  },
  reminderPillText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  reminderPillTextOn: {
    color: colors.success,
  },
  reminderPillTextOff: {
    color: colors.inkFaint,
  },
  medGridFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 12,
  },
  medGridDetails: {
    color: colors.primary,
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
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  docImageInner: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  pdfPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSoft,
    gap: 8,
    padding: 16,
  },
  pdfLabel: {
    color: colors.inkSecondary,
    textAlign: "center",
  },
  docTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 6,
    gap: 6,
  },
  docTitle: {
    flex: 1,
    color: colors.ink,
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
    color: colors.ink,
  },
  detailSubtitle: {
    marginTop: 2,
    color: colors.inkSecondary,
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
    color: colors.inkMuted,
    textTransform: "uppercase",
  },
  detailRowValue: {
    color: colors.ink,
    lineHeight: 22,
  },
  detailSectionLabel: {
    color: colors.inkMuted,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  reminderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  reminderToggleText: {
    flex: 1,
  },
  reminderToggleTitle: {
    color: colors.ink,
  },
  reminderToggleSub: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  editTimesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
  },
  editTimesBtnText: {
    color: colors.primary,
  },
  detailDoneBtn: {
    marginTop: 16,
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
    lineHeight: 20,
    color: colors.inkSecondary,
    textAlign: "center",
  },
});