import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, GlassPanel, Text, Typography, Button, Input } from "@/components/ui";
import { colors, radius, typography, spacing } from "@/lib/theme";
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
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screenCentered, { paddingHorizontal: spacing.xl }]}>
        <Card style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={48} color={colors.danger} />
          <Typography variant="heading3" style={styles.errorTitle}>Something Went Wrong</Typography>
          <Typography variant="bodyMd" style={styles.errorDesc}>{loadError}</Typography>
          <Button title="Retry" variant="primary" onPress={() => userId && fetchData()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="heading2" style={styles.headerTitle}>Patients</Typography>
        <Typography variant="bodySm" style={styles.headerSubtitle}>
          {patients.length} patient{patients.length !== 1 ? "s" : ""}
        </Typography>
      </View>

      {/* Patient Folders */}
      {patients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="people" size={36} color={colors.primary} />
          </View>
          <Typography variant="heading3" style={styles.emptyTitle}>No Patients Yet</Typography>
          <Typography variant="bodyMd" style={styles.emptyDesc}>
            Add a patient folder to start tracking medications and documents.
          </Typography>
          <Button title="Add Patient" variant="primary" onPress={openAddModal} />
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
                    <Typography variant="title" style={styles.patientName} numberOfLines={1}>{item.name}</Typography>
                    <Typography variant="caption" style={styles.patientMeta}>
                      {item.dateAdded ? `Added ${new Date(item.dateAdded).toLocaleDateString()}` : ""}
                    </Typography>
                  </View>
                  <View style={styles.patientActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      style={styles.iconBtn}
                      hitSlop={8}
                    >
                      <MaterialIcons name="edit" size={20} color={colors.inkMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePatient(item)}
                      style={styles.iconBtn}
                      hitSlop={8}
                    >
                      <MaterialIcons name="delete" size={20} color={colors.danger} />
                    </TouchableOpacity>
                    <MaterialIcons name="chevron-right" size={20} color={colors.inkFaint} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {/* Floating Action Buttons */}
      <TouchableOpacity
        onPress={() => router.push("/scanner")}
        activeOpacity={0.8}
        style={styles.fabScan}
        accessibilityRole="button"
        accessibilityLabel="Scan documents"
      >
        <MaterialIcons name="document-scanner" size={24} color={colors.white} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openAddModal}
        activeOpacity={0.8}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Add patient"
      >
        <MaterialIcons name="person-add" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Add Patient Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <GlassPanel variant="elevated" style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>Add Patient</Typography>
            <Typography variant="bodyMd" style={styles.modalDesc}>Create a folder to organize medications and documents.</Typography>
            <Input
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setAddModalVisible(false)} />
              <Button title={modalSaving ? "Adding..." : "Add"} variant="primary" onPress={handleAddPatient} disabled={!modalName.trim() || modalSaving} loading={modalSaving} />
            </View>
          </GlassPanel>
        </View>
      </Modal>

      {/* Edit Patient Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <GlassPanel variant="elevated" style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>Edit Patient</Typography>
            <Typography variant="bodyMd" style={styles.modalDesc}>Update the patient folder name.</Typography>
            <Input
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setEditModalVisible(false)} />
              <Button title={modalSaving ? "Saving..." : "Save"} variant="primary" onPress={handleEditPatient} disabled={!modalName.trim() || modalSaving} loading={modalSaving} />
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
    backgroundColor: colors.canvasSoft,
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasSoft,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: spacing.xl,
  },
  headerTitle: {
    color: colors.ink,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.inkSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  separator: {
    height: 12,
  },
  patientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
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
    color: colors.ink,
  },
  patientMeta: {
    marginTop: 2,
    color: colors.inkMuted,
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
    paddingHorizontal: spacing.xl,
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
    color: colors.ink,
    textAlign: "center",
  },
  emptyDesc: {
    marginTop: 8,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fabScan: {
    position: "absolute",
    right: spacing.xl,
    bottom: 168,
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 20,
    color: colors.inkSecondary,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: 8,
  },
  errorCard: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  errorTitle: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
  errorDesc: {
    marginTop: spacing.md,
    color: colors.inkMuted,
    textAlign: "center",
  },
});