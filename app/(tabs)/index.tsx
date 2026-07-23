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
import { GlassCard, Text } from "@/components/ui";
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

  async function fetchData(uid: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const currentRequest = ++requestIdRef.current;
    setLoadError(null);

    try {
      await initializeDatabase();
      const allPatients = await getAllPatients(uid);
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
  }

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchData(userId);
      return () => { requestIdRef.current = ++requestIdRef.current; };
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRefresh() { if (userId) fetchData(userId, true); }

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
      <View className="flex-1 items-center justify-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-sm text-gray-400">Loading...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAFC] px-8">
        <GlassCard intensity={30} tint="light" className="items-center px-8 py-10">
          <MaterialIcons name="error-outline" size={56} color="#EF4444" />
          <Text className="mt-4 text-center text-lg font-semibold text-gray-900">Something Went Wrong</Text>
          <Text className="mt-2 text-center text-sm text-gray-400">{loadError}</Text>
          <TouchableOpacity onPress={() => userId && fetchData(userId)} className="mt-6 rounded-xl bg-blue-600 px-8 py-3.5">
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View className="px-6 pt-14 pb-4">
        <Text className="text-3xl font-bold text-gray-900">MediVault</Text>
        <Text className="mt-1 text-base text-gray-400">
          {patients.length} patient{patients.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Patient Folders */}
      {patients.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard intensity={30} tint="light" className="items-center px-8 py-10">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <MaterialIcons name="people" size={40} color="#93C5FD" />
            </View>
            <Text className="text-center text-xl font-semibold text-gray-900">No Patients Yet</Text>
            <Text className="mt-2 text-center text-sm text-gray-400">
              Add a patient folder to start tracking medications and documents.
            </Text>
            <TouchableOpacity onPress={openAddModal} className="mt-6 rounded-xl bg-blue-600 px-8 py-3.5">
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
                <Text className="font-semibold text-white">Add Patient</Text>
              </View>
            </TouchableOpacity>
          </GlassCard>
        </View>
      ) : (
        <>
          <FlatList
            data={patients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View className="h-3" />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" colors={["#2563EB"]} />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/patient/[id]", params: { id: String(item.id) } })}
                activeOpacity={0.7}
                className="mb-3 rounded-2xl border border-slate-200/60 bg-white p-4"
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <MaterialIcons name="person" size={24} color="#9CA3AF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                    <Text className="mt-0.5 text-xs text-gray-400">
                      {item.dateAdded ? `Added ${new Date(item.dateAdded).toLocaleDateString()}` : ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      className="rounded-lg p-2"
                      hitSlop={8}
                    >
                      <MaterialIcons name="edit" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePatient(item)}
                      className="rounded-lg p-2"
                      hitSlop={8}
                    >
                      <MaterialIcons name="delete" size={20} color="#DC2626" />
                    </TouchableOpacity>
                    <MaterialIcons name="chevron-right" size={18} color="#D1D5DB" style={{ marginLeft: 4 }} />
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
          >
            <MaterialIcons name="document-scanner" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Floating Add Button */}
          <TouchableOpacity
            onPress={openAddModal}
            activeOpacity={0.8}
            style={styles.fab}
          >
            <MaterialIcons name="person-add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Add Patient Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text className="mb-1 text-xl font-bold text-gray-900">Add Patient</Text>
            <Text className="mb-5 text-sm text-gray-400">Create a folder to organize medications and documents.</Text>
            <TextInput
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="rounded-xl border border-slate-200/60 bg-white px-4 py-3.5 text-base text-gray-900"
            />
            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity onPress={() => setAddModalVisible(false)} className="flex-1 items-center rounded-xl border border-slate-200/60 bg-white py-3.5">
                <Text className="font-semibold text-gray-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddPatient}
                disabled={!modalName.trim() || modalSaving}
                className="flex-1 items-center rounded-xl bg-blue-600 py-3.5"
              >
                <Text className="font-semibold text-white">{modalSaving ? "Adding..." : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Patient Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text className="mb-1 text-xl font-bold text-gray-900">Edit Patient</Text>
            <Text className="mb-5 text-sm text-gray-400">Update the patient folder name.</Text>
            <TextInput
              value={modalName}
              onChangeText={setModalName}
              placeholder="Patient name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="rounded-xl border border-slate-200/60 bg-white px-4 py-3.5 text-base text-gray-900"
            />
            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity onPress={() => setEditModalVisible(false)} className="flex-1 items-center rounded-xl border border-slate-200/60 bg-white py-3.5">
                <Text className="font-semibold text-gray-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditPatient}
                disabled={!modalName.trim() || modalSaving}
                className="flex-1 items-center rounded-xl bg-blue-600 py-3.5"
              >
                <Text className="font-semibold text-white">{modalSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
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
  fab: {
    position: "absolute",
    right: 24,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabScan: {
    position: "absolute",
    right: 24,
    bottom: 168,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
});
