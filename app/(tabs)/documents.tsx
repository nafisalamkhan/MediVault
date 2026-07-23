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
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { GlassCard, Text } from "@/components/ui";
import {
  initializeDatabase,
  getAllPatients,
  getDocumentsByPatient,
  deleteDocument,
} from "@/lib/db";
import type { Patient, Document } from "@/lib/db/schema";

interface DocumentWithPatient extends Document {
  patientName?: string;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [documents, setDocuments] = useState<DocumentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData(uid: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await initializeDatabase();
      const patients = await getAllPatients(uid);
      const allDocs: DocumentWithPatient[] = [];

      for (const patient of patients) {
        const docs = await getDocumentsByPatient(patient.id, uid);
        for (const doc of docs) {
          allDocs.push({ ...doc, patientName: patient.name });
        }
      }

      allDocs.sort(
        (a, b) =>
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      );
      setDocuments(allDocs);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchData(userId);
    }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleRefresh() {
    if (userId) fetchData(userId, true);
  }

  function handleDeleteDocument(doc: DocumentWithPatient) {
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
        <Text style={{ marginTop: 12, fontSize: 14, color: "#9CA3AF" }}>
          Loading documents...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <Text style={styles.headerSubtitle}>
          {documents.length} document{documents.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <GlassCard intensity={30} tint="light" style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="insert-drive-file" size={40} color="#93C5FD" />
            </View>
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptyDesc}>
              Scan a document and save it to a patient folder to see it here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={styles.emptyBtn}
            >
              <MaterialIcons name="document-scanner" size={20} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Scan Now</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.docRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563EB"
              colors={["#2563EB"]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.docCard}
              onLongPress={() => handleDeleteDocument(item)}
            >
              <Image
                source={{ uri: item.imageUri }}
                style={styles.docImage}
                resizeMode="cover"
              />
              <View style={styles.docInfo}>
                <Text style={styles.docPatientName} numberOfLines={1}>
                  {item.patientName || "Unknown"}
                </Text>
                <Text style={styles.docDate}>
                  {new Date(item.dateAdded).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#9CA3AF",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  docRow: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  docCard: {
    width: "48%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  docImage: {
    width: "100%",
    height: 180,
  },
  docInfo: {
    padding: 10,
    backgroundColor: "white",
  },
  docPatientName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  docDate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  emptyDesc: {
    marginTop: 8,
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
