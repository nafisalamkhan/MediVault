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
import { Card, Text, Typography, Button } from "@/components/ui";
import { colors, radius, typography, spacing, shadows } from "@/lib/theme";
import { useToast } from "@/components/Toast";
import * as DocumentPicker from "expo-document-picker";
import { File, Directory, Paths } from "expo-file-system";
import {
  initializeDatabase,
  getAllPatients,
  getDocumentsByPatient,
  deleteDocuments,
  addDocument,
} from "@/lib/db";
import type { Document } from "@/lib/db/schema";

interface DocumentWithPatient extends Document {
  patientName?: string;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToast();

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

  async function handleUpload() {
    if (!userId) return;
    const patients = await getAllPatients(userId);
    if (patients.length === 0) {
      Alert.alert("No patient", "Create a patient first to upload documents.");
      return;
    }
    if (patients.length === 1) {
      showFilePicker(patients[0].id);
      return;
    }
    Alert.alert("Select Patient", "Choose patient folder", [
      ...patients.map((p) => ({ text: p.name, onPress: () => showFilePicker(p.id) })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function showFilePicker(patientId: number) {
    pickFile(patientId);
  }

  async function pickFile(patientId: number) {
    if (!userId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const isPdf = asset.mimeType === "application/pdf" || asset.name?.toLowerCase().endsWith(".pdf");
      await saveFile(asset.uri, patientId, isPdf ? "pdf" : "image", asset.name);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "Could not open picker.");
    }
  }

  async function saveFile(uri: string, patientId: number, kind: "image" | "pdf", originalName?: string) {
    if (!userId) return;
    try {
      const docsDir = new Directory(Paths.document, "documents");
      if (!docsDir.exists) docsDir.create();
      const ext = kind === "pdf" ? "pdf" : "jpg";
      const filename = `doc_${patientId}_${Date.now()}.${ext}`;
      const destFile = new File(docsDir, filename);
      const srcFile = new File(uri);
      srcFile.copy(destFile);
      await initializeDatabase();
      const title = originalName || filename;
      const docId = await addDocument({ ownerId: userId, patientId, imageUri: destFile.uri, title, extractedText: "" }, userId);
      showToast("Document uploaded", "success");
      fetchData(userId, true);
      router.push(`/document/${docId}` as any);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "Could not save document.");
    }
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
      router.push(`/document/${doc.id}` as any);
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
        <Typography variant="bodyMd" style={styles.loadingText}>Loading documents...</Typography>
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
          <Typography variant="title" style={styles.selectCount}>
            {selectedIds.size} selected
          </Typography>
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
          <View style={{ flex: 1 }}>
            <Typography variant="heading2" style={styles.headerTitle}>Documents</Typography>
            <Typography variant="bodySm" style={styles.headerSubtitle}>
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </Typography>
          </View>
          <TouchableOpacity onPress={handleUpload} style={styles.uploadBtn} activeOpacity={0.8}>
            <MaterialIcons name="upload-file" size={18} color={colors.white} />
            <Typography variant="button" style={styles.uploadBtnText}>Upload</Typography>
          </TouchableOpacity>
        </View>
      )}

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="insert-drive-file" size={36} color={colors.primary} />
            </View>
            <Typography variant="heading3" style={styles.emptyTitle}>No Documents Yet</Typography>
            <Typography variant="bodyMd" style={styles.emptyDesc}>
              Scan a document and save it to a patient folder to see it here.
            </Typography>
            <Button
              title="Scan Now"
              variant="primary"
              onPress={() => router.push("/scanner")}
              style={styles.emptyBtn}
            />
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
            const isPdf = item.imageUri.toLowerCase().endsWith(".pdf");
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.docCard}
                onPress={() => handleDocPress(item)}
                onLongPress={() => handleLongPress(item)}
              >
                <View style={[styles.docImageWrap, isSelected && styles.docImageWrapSelected]}>
                  {selectMode && (
                    <View style={styles.checkbox} pointerEvents="none">
                      <MaterialIcons
                        name={isSelected ? "check-circle" : "radio-button-unchecked"}
                        size={22}
                        color={isSelected ? colors.primary : "rgba(255,255,255,0.7)"}
                      />
                    </View>
                  )}
                  {isPdf ? (
                    <View style={styles.pdfPlaceholder}>
                      <MaterialIcons name="picture-as-pdf" size={40} color={colors.danger} />
                      <Typography variant="caption" style={styles.pdfLabel} numberOfLines={1}>{item.title || "PDF"}</Typography>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.docImage}
                      resizeMode="cover"
                    />
                  )}
                </View>
                <View style={styles.docInfo}>
                  <View style={styles.docInfoRow}>
                    <Typography variant="caption" style={styles.docPatientName} numberOfLines={1}>
                      {item.patientName || "Unknown"}
                    </Typography>
                    <MaterialIcons name="open-in-new" size={12} color={colors.primary} />
                  </View>
                  <Typography variant="caption" style={styles.docDate}>
                    {new Date(item.dateAdded).toLocaleDateString()}
                  </Typography>
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
    backgroundColor: colors.canvasSoft,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasSoft,
  },
  loadingText: {
    marginTop: 12,
    color: colors.inkMuted,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: spacing.xl,
    gap: 12,
  },
  headerTitle: {
    color: colors.ink,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.inkSecondary,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows.card,
  },
  uploadBtnText: {
    color: colors.white,
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
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
    color: colors.ink,
  },
  selectActions: {
    flexDirection: "row",
    gap: 8,
  },
  selectActionBtn: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.surface,
  },
  pdfPlaceholder: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSoft,
    gap: 8,
    padding: 12,
  },
  pdfLabel: {
    color: colors.inkSecondary,
    textAlign: "center",
  },
  docInfo: {
    padding: 12,
    paddingHorizontal: 4,
  },
  docInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  docPatientName: {
    flex: 1,
    color: colors.ink,
  },
  docDate: {
    marginTop: 2,
    color: colors.inkMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
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
    color: colors.ink,
  },
  emptyDesc: {
    marginTop: 8,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 24,
  },
});