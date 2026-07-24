import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraView as CameraViewType } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Paths, File, Directory } from "expo-file-system";
import { useAuth } from "@clerk/clerk-expo";
import { Text } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  initializeDatabase,
  getAllPatients,
  getPatientById,
  addDocument,
} from "@/lib/db";
import type { Patient } from "@/lib/db/schema";

export default function ScannerScreen() {
  const router = useRouter();
  const { patientId: preselectedPatientId } = useLocalSearchParams<{
    patientId?: string;
  }>();
  const { userId } = useAuth();
  const { showToast } = useToast();
  const cameraRef = useRef<CameraViewType>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [preselectedPatient, setPreselectedPatient] = useState<Patient | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  async function loadPatients() {
    if (!userId) return;
    try {
      await initializeDatabase();
      if (preselectedPatientId) {
        const p = await getPatientById(Number(preselectedPatientId), userId);
        setPreselectedPatient(p);
      }
      const list = await getAllPatients(userId);
      setPatients(list);
    } catch (err: any) {
      showToast(err.message || "Failed to load patients.", "error");
    }
  }

  useEffect(() => {
    loadPatients();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 32 }]}>
        <View style={styles.permissionCard}>
          <MaterialIcons name="camera-alt" size={64} color="#D1D5DB" />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permDesc}>
            MediVault needs access to your camera to capture medical documents
            and prescriptions.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={styles.permBtnPrimary}
          >
            <Text style={styles.permBtnPrimaryText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.permBtnSecondary}
          >
            <Text style={styles.permBtnSecondaryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || isCapturing || !isCameraReady) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.9,
      });
      if (photo) {
        setCapturedImage(photo.uri);
      }
    } catch {
      Alert.alert("Capture Error", "Failed to take photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }

  function handleRetake() {
    setCapturedImage(null);
  }

  function handleSavePress() {
    if (!capturedImage) return;
    if (preselectedPatient) {
      handleSelectPatient(preselectedPatient);
    } else {
      loadPatients();
      setPickerVisible(true);
    }
  }

  async function handleSelectPatient(patient: Patient) {
    if (!capturedImage || !userId || saving) return;
    setPickerVisible(false);
    setSaving(true);
    try {
      const docsDir = new Directory(Paths.document, "documents");
      if (!docsDir.exists) {
        docsDir.create();
      }
      const filename = `doc_${patient.id}_${Date.now()}.jpg`;
      const destFile = new File(docsDir, filename);
      const srcFile = new File(capturedImage);
      srcFile.copy(destFile);

      let saved = false;
      try {
        await initializeDatabase();
        await addDocument(
          {
            ownerId: userId,
            patientId: patient.id,
            imageUri: destFile.uri,
            title: filename,
          },
          userId
        );
        saved = true;
      } finally {
        if (!saved && destFile.exists) {
          destFile.delete();
        }
      }

      showToast(`Saved to ${patient.name}'s folder`, "success");
      setCapturedImage(null);
      router.back();
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "Failed to save document.");
    } finally {
      setSaving(false);
    }
  }

  // Post-capture preview
  if (capturedImage) {
    return (
      <View style={styles.screen}>
        <Image
          source={{ uri: capturedImage }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="contain"
          accessibilityLabel="Captured document preview"
        />

        <View style={styles.previewTopBar}>
          <TouchableOpacity
            onPress={handleRetake}
            style={styles.circleBtn}
            accessibilityLabel="Discard photo"
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Preview</Text>
          </View>
        </View>

        <View style={styles.previewBottomBar}>
          <TouchableOpacity
            onPress={handleRetake}
            activeOpacity={0.8}
            style={styles.retakeBtn}
          >
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSavePress}
            activeOpacity={0.8}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save Document"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Patient Picker Modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 4,
                }}
              >
                Save to Patient
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#9CA3AF",
                  marginBottom: 16,
                }}
              >
                Choose a patient folder for this document.
              </Text>
              {patients.length === 0 ? (
                <View
                  style={{ alignItems: "center", paddingVertical: 24 }}
                >
                  <MaterialIcons name="folder-open" size={40} color="#D1D5DB" />
                  <Text
                    style={{
                      marginTop: 8,
                      fontSize: 14,
                      color: "#9CA3AF",
                      textAlign: "center",
                    }}
                  >
                    No patients yet. Add a patient from the Home tab first.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={patients}
                  keyExtractor={(item) => String(item.id)}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectPatient(item)}
                      style={styles.patientRow}
                      disabled={saving}
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
                onPress={() => setPickerVisible(false)}
                style={styles.cancelBtn}
                disabled={saving}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Live camera
  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        mode="picture"
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Overlay */}
      <View style={styles.cameraOverlay}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Close camera"
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.docFrame} />

        <Text style={styles.instructionText}>
          Align document within the frame
        </Text>
      </View>

      {/* Shutter Button */}
      <View style={styles.shutterContainer}>
        <TouchableOpacity
          onPress={handleCapture}
          disabled={isCapturing || !isCameraReady}
          activeOpacity={0.7}
          style={styles.shutterBtn}
          accessibilityLabel="Take photo"
        >
          {isCapturing ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
        {!isCameraReady && (
          <Text style={styles.loadingText}>Camera loading...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  permissionCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 32,
  },
  permTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  permDesc: {
    marginTop: 8,
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  permBtnPrimary: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permBtnPrimaryText: { color: "#FFFFFF", fontWeight: "600" },
  permBtnSecondary: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permBtnSecondaryText: { color: "#374151", fontWeight: "600" },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    left: 16,
    top: 56,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
  },
  docFrame: {
    height: 288,
    width: 224,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.3)",
  },
  instructionText: {
    position: "absolute",
    bottom: 180,
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  shutterContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterBtn: {
    height: 80,
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  shutterInner: {
    height: 64,
    width: 64,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  previewTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  circleBtn: {
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
  },
  previewBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },
  previewBottomBar: {
    position: "absolute",
    bottom: 48,
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 16,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 16,
  },
  retakeBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
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
  cancelBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
});
