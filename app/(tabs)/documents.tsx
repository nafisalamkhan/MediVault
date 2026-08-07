import { useCallback, useEffect, useState } from "react";
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
import { Card, Text } from "@/components/ui";
import { colors, radius, fonts, typography } from "@/lib/theme";
import {
  initializeDatabase,
  getAllPatients,
  getDocumentsByPatient,
  deleteDocuments,
} from "@/lib/db";
import type { Document } from "@/lib/db/schema";

interface DocumentWithPatient extends Document {
  patientName?: string;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [documents, setDocuments] = useState<DocumentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    }, [userId])
  );

  function handleRefresh() {
    if (userId) fetchData(userId, true);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (selectedIds.size === 0 && selectMode) {
      setSelectMode(false);
    }
  }, [selectedIds, selectMode]);

  function handleLongPress(doc: DocumentWithPatient) {
    if (!selectMode) {
      setSelectMode(true);
      setSelectedIds(new Set([doc.id]));
    }
  }

  function handleDocPress(doc: DocumentWithPatient) {
    if (selectMode) {
      toggleSelect(doc.id);
    } else {
      router.push({
        pathname: "/document/[id]" as any,
        params: { id: String(doc.id) },
      });
    }
  }

  function handleSelectAll() {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      "Delete Documents",
      `Remove ${count} document${count !== 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!userId) return;
            try {
              await deleteDocuments(Array.from(selectedIds), userId);
              setDocuments((prev) =>
                prev.filter((d) => !selectedIds.has(d.id))
              );
              setSelectedIds(new Set());
              setSelectMode(false);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete.");
            }
          },
        },
      ]
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      {selectMode ? (
        <View style={styles.selectHeader}>
          <TouchableOpacity onPress={exitSelectMode} style={styles.backBtnSmall}>
            <MaterialIcons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.selectCount}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectActions}>
            <TouchableOpacity
              onPress={handleSelectAll}
              style={styles.selectActionBtn}
            >
              <MaterialIcons
                name={
                  selectedIds.size === documents.length
                    ? "deselect"
                    : "select-all"
                }
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkDelete}
              style={styles.selectActionBtn}
              disabled={selectedIds.size === 0}
            >
              <MaterialIcons
                name="delete"
                size={22}
                color={selectedIds.size > 0 ? colors.danger : colors.hairline}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Documents</Text>
          <Text style={styles.headerSubtitle}>
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="insert-drive-file" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptyDesc}>
              Scan a document and save it to a patient folder to see it here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={styles.emptyBtn}
            >
              <MaterialIcons name="document-scanner" size={18} color={colors.white} />
              <Text style={styles.emptyBtnText}>Scan Now</Text>
            </TouchableOpacity>
          </Card>
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
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.docCard}
                onPress={() => handleDocPress(item)}
                onLongPress={() => handleLongPress(item)}
              >
                <View style={[styles.docImageWrap, isSelected && styles.docImageWrapSelected]}>
                  {selectMode && (
                    <View style={styles.checkbox}>
                      <MaterialIcons
                        name={isSelected ? "check-circle" : "radio-button-unchecked"}
                        size={22}
                        color={isSelected ? colors.primary : "rgba(255,255,255,0.7)"}
                      />
                    </View>
                  )}
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.docImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docPatientName} numberOfLines={1}>
                    {item.patientName || "Unknown"}
                  </Text>
                  <Text style={styles.docDate}>
                    {new Date(item.dateAdded).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasParchment,
  },
  centered: {
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
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: "600",
    lineHeight: typography.headline.lineHeight,
    letterSpacing: typography.headline.letterSpacing,
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkSecondary,
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
  },
  backBtnSmall: {
    padding: 8,
    marginRight: 8,
  },
  selectCount: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  selectActions: {
    flexDirection: "row",
    gap: 8,
  },
  selectActionBtn: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
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
  },
  docImageWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfacePearl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  docImageWrapSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  checkbox: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  docImage: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfacePearl,
  },
  docInfo: {
    padding: 12,
    paddingHorizontal: 4,
  },
  docPatientName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  docDate: {
    fontSize: 12,
    color: colors.inkTertiary,
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
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
});
