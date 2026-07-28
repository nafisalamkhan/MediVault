import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  deleteDocument,
  updateDocumentTitle,
  moveDocument,
  copyDocument,
} from "@/lib/db";
import type { Document, Patient } from "@/lib/db/schema";

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

  const docId = Number(id);

  async function fetchData(uid: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await initializeDatabase();
      const doc = await getDocumentById(docId, uid);
      setDocument(doc);

      if (doc) {
        const p = await getPatientById(doc.patientId, uid);
        setPatient(p);
        const allPts = await getAllPatients(uid);
        setPatients(allPts.filter((pt) => pt.id !== doc.patientId));
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

        {/* Extracted Text Section */}
        <View style={styles.textSection}>
          <View style={styles.textHeader}>
            <MaterialIcons name="text-snippet" size={20} color="#2563EB" />
            <Text style={styles.textTitle}>Extracted Data</Text>
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
                <View key={index} style={styles.textLine}>
                  <Text style={styles.lineNumber}>{index + 1}</Text>
                  <Text style={styles.lineText}>{line.trim()}</Text>
                </View>
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
  textLine: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F1F5F9",
  },
  lineNumber: {
    width: 28,
    fontSize: 11,
    color: "#D1D5DB",
    fontVariant: ["tabular-nums"],
  },
  lineText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
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
