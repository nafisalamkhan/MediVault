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
import { Text, GlassCard } from "@/components/ui";
import ReminderSettingsModal from "@/components/ReminderSettingsModal";
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
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color="#D1D5DB" />
        <Text style={{ marginTop: 12, fontSize: 16, color: "#9CA3AF" }}>
          Patient not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 15, color: "#2563EB", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
            {patient.name}
          </Text>
          <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
            Patient Folder
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/scanner", params: { patientId: String(patient.id) } })}
          style={styles.scanBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="document-scanner" size={20} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>Scan</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <MaterialIcons name="person" size={28} color="#2563EB" />
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Medications Section */}
            <Text style={styles.sectionTitle}>Medications</Text>
            {visibleMeds.length === 0 ? (
              <GlassCard intensity={30} tint="light" style={{ marginBottom: 20 }}>
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <MaterialIcons name="local-hospital" size={32} color="#93C5FD" />
                  <Text style={{ marginTop: 8, fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
                    No medications yet.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <View style={{ marginBottom: 20 }}>
                {visibleMeds.map((med) => (
                  <TouchableOpacity
                    key={String(med.id)}
                    activeOpacity={0.8}
                    onPress={() => setSelectedMed(med)}
                  >
                    <Card>
                      <View style={styles.medRow}>
                        <View style={styles.medIcon}>
                          <MaterialIcons name="local-hospital" size={20} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                            {med.name}
                          </Text>
                          <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
                            {med.dosage} · {med.frequency}
                          </Text>
                          {med.reminderEnabled === 1 ? (
                            <Text style={styles.medReminderStatus}>
                              🔔 {formatReminderTimes(parseReminderTimes(med.reminderTimes))}
                            </Text>
                          ) : null}
                        </View>
                        <MaterialIcons name="chevron-right" size={18} color="#D1D5DB" />
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Documents Section */}
            <Text style={styles.sectionTitle}>Scanned Documents</Text>
            {documents.length === 0 ? (
              <GlassCard intensity={30} tint="light">
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <MaterialIcons name="insert-drive-file" size={32} color="#93C5FD" />
                  <Text style={{ marginTop: 8, fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
                    No documents yet.{"\n"}Tap &quot;Scan&quot; above to save a document here.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <View style={styles.docGrid}>
                {documents.map((doc) => (
                  <TouchableOpacity
                    key={String(doc.id)}
                    activeOpacity={0.8}
                    style={styles.docCard}
                    onPress={() => router.push({ pathname: "/document/[id]" as any, params: { id: String(doc.id) } })}
                  >
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
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      />

      {/* Medication Details Modal */}
      <Modal
        visible={selectedMed !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMed(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailMedIcon}>
                <MaterialIcons name="local-hospital" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
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
                <MaterialIcons name="close" size={22} color="#9CA3AF" />
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderToggleTitle}>Daily reminder</Text>
                  <Text style={styles.reminderToggleSub}>
                    {selectedMed?.reminderEnabled === 1
                      ? `🔔 ${formatReminderTimes(
                          parseReminderTimes(selectedMed.reminderTimes)
                        )}`
                      : "Reminders are off"}
                  </Text>
                </View>
                <Switch
                  value={selectedMed?.reminderEnabled === 1}
                  onValueChange={(v) => {
                    if (selectedMed) handleToggleReminder(selectedMed, v);
                  }}
                  disabled={reminderBusyId !== null}
                  trackColor={{ true: "#2563EB", false: "#D1D5DB" }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedMed) setReminderEditor(selectedMed);
                }}
                style={styles.editTimesBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="alarm-add" size={20} color="#2563EB" />
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
          </View>
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.card}>{children}</View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>
        <MaterialIcons name={icon} size={16} color="#2563EB" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F8FAFC",
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  medIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  medReminderStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A",
    marginTop: 4,
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
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  detailSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
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
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  detailRowLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailRowValue: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  reminderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  reminderToggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reminderToggleSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  editTimesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
  },
  editTimesBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2563EB",
  },
  detailDoneBtn: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
  },
  detailDoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  docGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  docCard: {
    width: "48%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  docImage: {
    width: "100%",
    height: "100%",
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
});
