import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, GlassPanel, Text } from "@/components/ui";
import { colors, radius, fonts, typography } from "@/lib/theme";
import {
  initializeDatabase,
  getAllPatients,
  addPatient,
  updatePatient,
  deletePatient,
} from "@/lib/db";
import type { Patient } from "@/lib/db/schema";

export default function HomeScreen() {
  const { userId } = useAuth();
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const currentRequest = ++requestIdRef.current;
    setLoadError(null);

    try {
      await initializeDatabase();
      const allPatients = await getAllPatients(userId);
      if (requestIdRef.current !== currentRequest) return;
      setPatients(allPatients);
    } catch (err: any) {
      if (requestIdRef.current === currentRequest) {
        setLoadError(err.message || "Failed to load data. Please try again.");
      }
    } finally {
      if (requestIdRef.current === currentRequest) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchData();
      return () => { requestIdRef.current = ++requestIdRef.current; };
    }, [userId, fetchData])
  );

  function handleRefresh() { fetchData(true); }

  function openAddModal() { setModalName(""); setAddModalVisible(true); }

  function openEditModal(patient: Patient) {
    setEditingPatient(patient);
    setModalName(patient.name);
    setEditModalVisible(true);
  }

  async function handleAddPatient() {
    const name = modalName.trim();
    if (!name || !userId || modalSaving) return;
    setModalSaving(true);
    try {
      await initializeDatabase();
      const id = await addPatient({ ownerId: userId, name }, userId);
      const p: Patient = { id, ownerId: userId, name, dateAdded: new Date().toISOString() };
      setPatients((prev) => [p, ...prev]);
      setAddModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add patient.");
    } finally { setModalSaving(false); }
  }

  async function handleEditPatient() {
    const name = modalName.trim();
    if (!name || !userId || !editingPatient || modalSaving) return;
    setModalSaving(true);
    try {
      await updatePatient(editingPatient.id, userId, name);
      setPatients((prev) => prev.map((p) => p.id === editingPatient.id ? { ...p, name } : p));
      setEditModalVisible(false);
      setEditingPatient(null);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update patient.");
    } finally { setModalSaving(false); }
  }

  function handleDeletePatient(patient: Patient) {
    if (!userId) return;
    Alert.alert("Delete Patient", `Remove "${patient.name}" and all their data?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deletePatient(patient.id, userId);
            setPatients((prev) => prev.filter((p) => p.id !== patient.id));
          } catch (err: any) { Alert.alert("Error", err.message || "Failed to delete."); }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.screenCentered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screenCentered, { paddingHorizontal: 32 }]}>
        <Card style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Something Went Wrong</Text>
          <Text style={styles.errorDesc}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => userId && fetchData()}
            style={styles.pillPrimary}
          >
            <Text style={styles.pillPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSubtitle}>
          {patients.length} patient{patients.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Patient Folders */}
      {patients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="people" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Patients Yet</Text>
          <Text style={styles.emptyDesc}>
            Add a patient folder to start tracking medications and documents.
          </Text>
          <TouchableOpacity onPress={openAddModal} style={styles.pillPrimary}>
            <View style={styles.pillRow}>
              <MaterialIcons name="person-add" size={18} color={colors.white} />
              <Text style={styles.pillPrimaryText}>Add Patient</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={patients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/patient/[id]", params: { id: String(item.id) } })}
                activeOpacity={0.7}
                style={styles.patientCard}
              >
                <View style={styles.patientRow}>
                  <View style={styles.patientAvatar}>
                    <MaterialIcons name="person" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.patientMeta}>
                      {item.dateAdded ? `Added ${new Date(item.dateAdded).toLocaleDateString()}` : ""}
                    </Text>
                  </View>
                  <View style={styles.patientActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      style={styles.iconBtn}
                      hitSlop={8}
                    >
                      <MaterialIcons name="edit" size={18} color={colors.inkSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePatient(item)}
                      style={styles.iconBtn}
                      hitSlop={8}
                    >
                      <MaterialIcons name="delete" size={18} color={colors.danger} />
                    </TouchableOpacity>
                    <MaterialIcons name="chevron-right" size={18} color={colors.inkTertiary} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* Floating Scan Button */}
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            activeOpacity={0.8}
            style={styles.fabScan}
            accessibilityRole="button"
            accessibilityLabel="Scan documents"
          >
            <MaterialIcons name="document-scanner" size={22} color={colors.white} />
          </TouchableOpacity>

          {/* Floating Add Button */}
          <TouchableOpacity
            onPress={openAddModal}
            activeOpacity={0.8}
            style={styles.fab}
            accessibilityRole="button"
            accessibilityLabel="Add patient"
          >
            <MaterialIcons name="person-add" size={24} color={colors.white} />
          </TouchableOpacity>
        </>
      )}

      {/* Add Patient Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Patient</Text>
            <Text style={styles.modalDesc}>Create a folder to organize medications and documents.</Text>
            <TextInput
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              placeholderTextColor={colors.inkTertiary}
              autoFocus
              style={styles.textInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddPatient}
                disabled={!modalName.trim() || modalSaving}
                style={[styles.modalConfirmBtn, (!modalName.trim() || modalSaving) && { opacity: 0.5 }]}
              >
                <Text style={styles.modalConfirmText}>{modalSaving ? "Adding..." : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      </Modal>

      {/* Edit Patient Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Patient</Text>
            <Text style={styles.modalDesc}>Update the patient folder name.</Text>
            <TextInput
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              placeholderTextColor={colors.inkTertiary}
              autoFocus
              style={styles.textInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditPatient}
                disabled={!modalName.trim() || modalSaving}
                style={[styles.modalConfirmBtn, (!modalName.trim() || modalSaving) && { opacity: 0.5 }]}
              >
                <Text style={styles.modalConfirmText}>{modalSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasParchment,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.inkTertiary,
  },
  header: {
    paddingTop: 64,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: typography.displayMd.fontSize,
    fontWeight: "600",
    lineHeight: typography.displayMd.lineHeight,
    letterSpacing: typography.displayMd.letterSpacing,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkSecondary,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  separator: {
    height: 12,
  },
  patientCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    padding: 16,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  patientMeta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.inkTertiary,
  },
  patientActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: typography.displayMd.fontSize,
    fontWeight: "600",
    lineHeight: typography.displayMd.lineHeight,
    letterSpacing: typography.displayMd.letterSpacing,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  emptyDesc: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  pillPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  errorCard: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  errorDesc: {
    marginTop: 8,
    fontSize: 14,
    color: colors.inkTertiary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  fabScan: {
    position: "absolute",
    right: 24,
    bottom: 168,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
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
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
    letterSpacing: -0.374,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  modalDesc: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSecondary,
  },
  textInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  modalActions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.canvas,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
});
