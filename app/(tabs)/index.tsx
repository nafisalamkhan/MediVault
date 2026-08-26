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
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Card, Typography, Button, Input } from "@/components/ui";
import { useDrawer } from "@/hooks/useDrawer";
import { colors, radius, typography, spacing, shadows } from "@/lib/theme";
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
  const { openDrawer } = useDrawer();

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
          <MaterialIcons name="error-outline" size={40} color={colors.danger} />
          <Typography variant="heading3" style={styles.errorTitle}>Something Went Wrong</Typography>
          <Typography variant="body" style={styles.errorDesc}>{loadError}</Typography>
          <Button title="Retry" variant="primary" onPress={() => userId && fetchData()} />
        </Card>
      </View>
    );
  }

  const bottomPadding = 100;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.drawerBtn}
          hitSlop={10}
          accessibilityLabel="Open menu"
        >
          <MaterialIcons name="menu" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Typography variant="heading1" style={styles.headerTitle}>MediVault</Typography>
        <Typography variant="bodySm" style={styles.headerSubtitle}>
          {patients.length} Patient{patients.length !== 1 ? "s" : ""}
        </Typography>
      </View>

      {/* Patient Folders */}
      {patients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="people" size={48} color={colors.primary} />
            </View>
            <Typography variant="heading2" style={styles.emptyTitle}>No Patients Yet</Typography>
            <Typography variant="body" style={styles.emptyDesc}>
              Add a patient folder to start tracking medications and documents.
            </Typography>
            <Button title="Add Patient" variant="primary" onPress={openAddModal} />
          </Card>
        </View>
      ) : (
        <>
          <FlatList
            data={patients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
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
                activeOpacity={0.85}
                style={styles.patientCard}
              >
                <View style={styles.patientRow}>
                  <View style={styles.patientAvatar}>
                    <MaterialIcons name="person" size={24} color={colors.primary} />
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
                      style={styles.actionBtn}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="edit" size={22} color={colors.inkMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePatient(item)}
                      style={styles.actionBtn}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete" size={22} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {/* Premium FAB - smaller */}
      <TouchableOpacity
        onPress={openAddModal}
        activeOpacity={0.9}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Add patient"
      >
        <MaterialIcons name="add" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Add Patient Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>Add Patient</Typography>
            <Typography variant="body" style={styles.modalDesc}>Create a folder to organize medications and documents.</Typography>
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
          </Card>
        </View>
      </Modal>

      {/* Edit Patient Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Typography variant="heading3" style={styles.modalTitle}>Edit Patient</Typography>
            <Typography variant="body" style={styles.modalDesc}>Update the patient folder name.</Typography>
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
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  drawerBtn: {
    padding: 4,
  },
  headerTitle: {
    color: colors.ink,
    flex: 1,
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  separator: {
    height: 12,
  },
  patientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
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
    gap: 8,
  },
  actionBtn: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.ink,
    textAlign: "center",
  },
  emptyDesc: {
    marginTop: spacing.md,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: radius.xxl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.fab,
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  errorCard: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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