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
import { Text } from "@/components/ui";
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
  PrescriptionMedicine,
} from "@/lib/db/schema";
import { hasGeminiKey } from "@/lib/ai";
import { processPrescription, createMedicationForMedicine } from "@/lib/prescription";
import {
  parseReminderTimes,
  deriveReminderTimes,
  scheduleMedicationReminder,
  cancelMedicationReminder,
} from "@/lib/notifications";

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
    if (!analysis) return [];
    return analysis.medicines.map((m) => {
      const dbMed =
        medications.find(
          (med) =>
            med.name.trim().toLowerCase() === (m.name || "").trim().toLowerCase()
        ) ?? null;
      return { medicine: m, dbMed };
    });
  }, [analysis, medications]);

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
        text: document.extractedText,
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
        await scheduleMedicationReminder(
          { ...med, reminderTimes: timesJson },
          userId
        );
        setMedications((prev) =>
          prev.map((m) =>
            m.id === med.id
              ? { ...m, reminderEnabled: 1, reminderTimes: timesJson }
              : m
          )
        );
      } else {
        await cancelMedicationReminder(med, userId);
        setMedications((prev) =>
          prev.map((m) => (m.id === med.id ? { ...m, reminderEnabled: 0 } : m))
        );
      }
    } catch (err: any) {
      Alert.alert("Reminder Error", err.message || "Failed to update reminder.");
    } finally {
      setReminderBusyId(null);
    }
  }

  async function handleAddReminder(medicine: PrescriptionMedicine) {
    if (!userId || !document || reminderBusyId !== null) return;
    setReminderBusyId(-1);
    try {
      const medId = await createMedicationForMedicine({
        patientId: document.patientId,
        ownerId: userId,
        medicine,
      });
      if (medId != null) {
        const meds = await getMedicationsByPatient(document.patientId, userId);
        setMedications(meds);
      } else {
        Alert.alert(
          "Cannot Set Reminder",
          "No schedule could be derived from this medicine's frequency."
        );
      }
    } catch (err: any) {
      Alert.alert("Reminder Error", err.message || "Failed to set reminder.");
    } finally {
      setReminderBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color="#D1D5DB" />
        <Text style={{ marginTop: 12, fontSize: 16, color: "#9CA3AF" }}>
          Document not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 15, color: "#2563EB", fontWeight: "600" }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lines = document.extractedText
    ? document.extractedText.split("\n").filter((l) => l.trim())
    : [];

  const doctor = analysis?.doctor;
  const hasDoctor = Boolean(
    doctor && (doctor.name || doctor.specialty || doctor.contact || doctor.address)
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      >
        {/* Image */}
        <Image
          source={{ uri: document.imageUri }}
          style={styles.documentImage}
          resizeMode="contain"
        />

        {/* Info Bar */}
        <View style={styles.infoBar}>
          <View style={styles.infoLeft}>
            <MaterialIcons name="calendar-today" size={14} color="#9CA3AF" />
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
            <View style={styles.infoRight}>
              <MaterialIcons name="person" size={14} color="#9CA3AF" />
              <Text style={styles.infoText}>{patient.name}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
              <MaterialIcons name="edit" size={18} color="#2563EB" />
            </View>
            <Text style={styles.actionLabel}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: "#FEF2F2" }]}>
              <MaterialIcons name="delete" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.actionLabel, { color: "#EF4444" }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
              <MaterialIcons name="content-copy" size={18} color="#16A34A" />
            </View>
            <Text style={[styles.actionLabel, { color: "#16A34A" }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMove} style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
              <MaterialIcons name="drive-file-move" size={18} color="#EA580C" />
            </View>
            <Text style={[styles.actionLabel, { color: "#EA580C" }]}>Move</Text>
          </TouchableOpacity>
        </View>

        {/* AI Explanation */}
        {analysis ? (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={20} color="#2563EB" />
              <Text style={styles.textTitle}>AI Explanation</Text>
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
        ) : hasGeminiKey() && lines.length > 0 ? (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="auto-awesome" size={20} color="#2563EB" />
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
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="auto-awesome" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.analyzeBtnText}>
                  {analyzing ? "Analyzing..." : "Analyze with AI"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Doctor */}
        {hasDoctor && (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="medical-services" size={20} color="#2563EB" />
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
            </View>
          </View>
        )}

        {/* Medicines & Reminders */}
        {analysis && medicineRows.length > 0 && (
          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <MaterialIcons name="local-hospital" size={20} color="#2563EB" />
              <Text style={styles.textTitle}>Medicines & Reminders</Text>
            </View>
            <View style={styles.sectionBody}>
              {medicineRows.map(({ medicine, dbMed }, idx) => (
                <View
                  key={idx}
                  style={[styles.medCard, idx > 0 && styles.medCardBorder]}
                >
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{medicine.name}</Text>
                    {medicine.dosage || medicine.frequency ? (
                      <Text style={styles.medMeta}>
                        {[medicine.dosage, medicine.frequency]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                    {medicine.duration ? (
                      <Text style={styles.medMeta}>Duration: {medicine.duration}</Text>
                    ) : null}
                    {medicine.instructions ? (
                      <Text style={styles.medInstructions}>
                        {medicine.instructions}
                      </Text>
                    ) : null}
                  </View>
                  {dbMed ? (
                    <Switch
                      value={dbMed.reminderEnabled === 1}
                      onValueChange={(v) => handleToggleReminder(dbMed, v)}
                      disabled={reminderBusyId !== null}
                      trackColor={{ true: "#2563EB", false: "#D1D5DB" }}
                      thumbColor="#FFFFFF"
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleAddReminder(medicine)}
                      disabled={reminderBusyId !== null}
                      style={styles.addReminderBtn}
                    >
                      <MaterialIcons
                        name="notifications-active"
                        size={16}
                        color="#2563EB"
                      />
                      <Text style={styles.addReminderText}>Remind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Extracted Text Section */}
        <View style={styles.textSection}>
          <View style={styles.textHeader}>
            <MaterialIcons name="text-snippet" size={20} color="#2563EB" />
            <Text style={styles.textTitle}>Extracted Text</Text>
          </View>

          {lines.length === 0 ? (
            <View style={styles.noTextContainer}>
              <MaterialIcons name="info-outline" size={20} color="#D1D5DB" />
              <Text style={styles.noText}>
                No text was extracted from this document.
              </Text>
            </View>
          ) : (
            <View style={styles.textContent}>
              {lines.map((line, index) => (
                <Text key={index} style={styles.lineText}>
                  {line.trim()}
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color="#374151" />
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Document</Text>
            <TextInput
              style={styles.textInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Document title"
              placeholderTextColor="#9CA3AF"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setActiveModal(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmEdit}
                style={[styles.modalConfirmBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading || !editTitle.trim()}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
          <View style={styles.modalCard}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={styles.dangerIcon}>
                <MaterialIcons name="warning" size={28} color="#EF4444" />
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
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[styles.modalDeleteBtn, actionLoading && { opacity: 0.6 }]}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeModal === "move" ? "Move to Patient" : "Copy to Patient"}
            </Text>
            <Text style={styles.modalDesc}>
              {activeModal === "move"
                ? "Select a patient folder to move this document to."
                : "Select a patient folder to copy this document to."}
            </Text>
            {patients.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <MaterialIcons name="folder-open" size={36} color="#D1D5DB" />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  No other patients available.
                </Text>
              </View>
            ) : (
              <FlatList
                data={patients}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() =>
                      activeModal === "move"
                        ? confirmMove(item)
                        : confirmCopy(item)
                    }
                    style={styles.patientRow}
                    disabled={actionLoading}
                  >
                    <View style={styles.patientAvatar}>
                      <MaterialIcons name="person" size={20} color="#2563EB" />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: "500",
                        color: "#111827",
                      }}
                    >
                      {item.name}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={18}
                      color="#D1D5DB"
                    />
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={styles.modalCancelBtnFull}
              disabled={actionLoading}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  documentImage: {
    width: "100%",
    height: 320,
    backgroundColor: "#E5E7EB",
  },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#6B7280",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  textSection: {
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  textHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  textTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  noTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 20,
    justifyContent: "center",
  },
  noText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  textContent: {
    padding: 16,
  },
  lineText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    paddingVertical: 3,
  },
  sectionBody: {
    padding: 16,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  analyzeDesc: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 14,
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
  },
  analyzeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
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
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E3A8A",
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
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  infoRowText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
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
    borderTopColor: "#F1F5F9",
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  medMeta: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  addReminderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addReminderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
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
    backgroundColor: "rgba(248, 250, 252, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
    paddingVertical: 14,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
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
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 16,
  },
  dangerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalDeleteBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#EF4444",
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalCancelBtnFull: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: "#F8FAFC",
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
        <MaterialIcons name={icon} size={16} color="#2563EB" />
      </View>
      <Text style={styles.infoRowText}>{value}</Text>
    </View>
  );
}
