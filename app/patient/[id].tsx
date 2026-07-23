import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, GlassCard } from "@/components/ui";
import {
  initializeDatabase,
  getPatientById,
  getMedicationsByPatient,
  getDocumentsByPatient,
  deleteDocument,
} from "@/lib/db";
import type { Patient, Medication, Document } from "@/lib/db/schema";

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const patientId = Number(id);

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

  function handleDeleteDocument(doc: Document) {
    if (!userId) return;
    Alert.alert("Delete Document", "Remove this saved scan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc.id, userId);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete.");
          }
        },
      },
    ]);
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
            {medications.length === 0 ? (
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
                {medications.map((med) => (
                  <Card key={String(med.id)}>
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
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color="#D1D5DB" />
                    </View>
                  </Card>
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
                    No documents yet.{"\n"}Tap "Scan" above to save a document here.
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
                    onLongPress={() => handleDeleteDocument(doc)}
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
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.card}>{children}</View>
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
