import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
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
import { extractTextFromImage } from "@/lib/ocr";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const HANDLE_SIZE = 32;
const MIN_CROP = 80;

type Phase = "camera" | "crop" | "preview";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function CropView({
  imageUri,
  imageWidth,
  imageHeight,
  onApply,
  onSkip,
}: {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (rect: CropRect) => void;
  onSkip: () => void;
}) {
  const viewW = SCREEN_W;
  const viewH = SCREEN_H - 120;
  const scale = Math.min(viewW / imageWidth, viewH / imageHeight);
  const dispW = imageWidth * scale;
  const dispH = imageHeight * scale;
  const offX = (viewW - dispW) / 2;
  const offY = (viewH - dispH) / 2;

  const [crop, setCrop] = useState<CropRect>({
    x: offX + 20,
    y: offY + 20,
    w: dispW - 40,
    h: dispH - 40,
  });
  const dragRef = useRef<{ corner: string; startX: number; startY: number; orig: CropRect } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, gesture) => {
        const px = gesture.x0;
        const py = gesture.y0;
        let corner = "body";
        const corners = [
          { name: "tl", cx: crop.x, cy: crop.y },
          { name: "tr", cx: crop.x + crop.w, cy: crop.y },
          { name: "bl", cx: crop.x, cy: crop.y + crop.h },
          { name: "br", cx: crop.x + crop.w, cy: crop.y + crop.h },
        ];
        for (const c of corners) {
          if (Math.abs(px - c.cx) < 30 && Math.abs(py - c.cy) < 30) {
            corner = c.name;
            break;
          }
        }
        if (corner === "body") {
          const inside =
            px >= crop.x &&
            px <= crop.x + crop.w &&
            py >= crop.y &&
            py <= crop.y + crop.h;
          if (!inside) corner = "br";
        }
        dragRef.current = {
          corner,
          startX: px,
          startY: py,
          orig: { ...crop },
        };
      },
      onPanResponderMove: (_e, gesture) => {
        if (!dragRef.current) return;
        const { corner, startX, startY, orig } = dragRef.current;
        const dx = gesture.dx;
        const dy = gesture.dy;

        setCrop((prev) => {
          let { x, y, w, h } = orig;
          if (corner === "tl") {
            x = Math.max(offX, Math.min(orig.x + dx, orig.x + orig.w - MIN_CROP));
            y = Math.max(offY, Math.min(orig.y + dy, orig.y + orig.h - MIN_CROP));
            w = orig.x + orig.w - x;
            h = orig.y + orig.h - y;
          } else if (corner === "tr") {
            y = Math.max(offY, Math.min(orig.y + dy, orig.y + orig.h - MIN_CROP));
            w = Math.max(MIN_CROP, Math.min(orig.w + dx, offX + dispW - orig.x));
            h = orig.y + orig.h - y;
          } else if (corner === "bl") {
            x = Math.max(offX, Math.min(orig.x + dx, orig.x + orig.w - MIN_CROP));
            w = orig.x + orig.w - x;
            h = Math.max(MIN_CROP, Math.min(orig.h + dy, offY + dispH - orig.y));
          } else if (corner === "br") {
            w = Math.max(MIN_CROP, Math.min(orig.w + dx, offX + dispW - orig.x));
            h = Math.max(MIN_CROP, Math.min(orig.h + dy, offY + dispH - orig.y));
          } else {
            const nx = x + dx;
            const ny = y + dy;
            x = Math.max(offX, Math.min(nx, offX + dispW - w));
            y = Math.max(offY, Math.min(ny, offY + dispH - h));
          }
          return { x, y, w, h };
        });
      },
      onPanResponderRelease: () => {
        dragRef.current = null;
      },
    })
  ).current;

  const corners = [
    { key: "tl", cx: crop.x, cy: crop.y },
    { key: "tr", cx: crop.x + crop.w, cy: crop.y },
    { key: "bl", cx: crop.x, cy: crop.y + crop.h },
    { key: "br", cx: crop.x + crop.w, cy: crop.y + crop.h },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <Image
          source={{ uri: imageUri }}
          style={{
            position: "absolute",
            left: offX,
            top: offY,
            width: dispW,
            height: dispH,
          }}
          resizeMode="contain"
        />
        {/* Dark overlay outside crop */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.6)" }]} />
        <Image
          source={{ uri: imageUri }}
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y,
            width: crop.w,
            height: crop.h,
          }}
          resizeMode="cover"
        />
        {/* Crop border */}
        <View
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y,
            width: crop.w,
            height: crop.h,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        />
        {/* Grid lines */}
        <View
          style={{
            position: "absolute",
            left: crop.x + crop.w / 3,
            top: crop.y,
            width: 1,
            height: crop.h,
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: crop.x + (crop.w * 2) / 3,
            top: crop.y,
            width: 1,
            height: crop.h,
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y + crop.h / 3,
            width: crop.w,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y + (crop.h * 2) / 3,
            width: crop.w,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />
        {/* Corner handles */}
        {corners.map((c) => (
          <View
            key={c.key}
            style={{
              position: "absolute",
              left: c.cx - 6,
              top: c.cy - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#FFFFFF",
            }}
          />
        ))}
      </View>

      {/* Bottom bar */}
      <View style={styles.cropBottomBar}>
        <TouchableOpacity onPress={onSkip} style={styles.cropSkipBtn}>
          <Text style={styles.cropSkipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onApply(crop)}
          style={styles.cropApplyBtn}
        >
          <MaterialIcons name="crop" size={18} color="#FFFFFF" />
          <Text style={styles.cropApplyText}>Apply Crop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ScannerScreen() {
  const router = useRouter();
  const { patientId: preselectedPatientId } = useLocalSearchParams<{
    patientId?: string;
  }>();
  const { userId } = useAuth();
  const { showToast } = useToast();
  const cameraRef = useRef<CameraViewType>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [croppedUri, setCroppedUri] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [preselectedPatient, setPreselectedPatient] = useState<Patient | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

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
        Image.getSize(
          photo.uri,
          (w: number, h: number) => {
            setImageDims({ w, h });
            setPhase("crop");
          },
          () => {
            setImageDims({ w: SCREEN_W, h: SCREEN_H });
            setPhase("crop");
          }
        );
      }
    } catch {
      Alert.alert("Capture Error", "Failed to take photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }

  function handleRetake() {
    setCapturedImage(null);
    setCroppedUri(null);
    setImageDims(null);
    setPhase("camera");
  }

  function handleCropDone(rect: CropRect) {
    if (!capturedImage || !imageDims) {
      setPhase("preview");
      return;
    }
    const { ImageManipulator } = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
    const manip = ImageManipulator.manipulate(capturedImage);
    const viewW = SCREEN_W;
    const viewH = SCREEN_H - 120;
    const scale = Math.min(viewW / imageDims.w, viewH / imageDims.h);
    const dispW = imageDims.w * scale;
    const dispH = imageDims.h * scale;
    const offX = (viewW - dispW) / 2;
    const offY = (viewH - dispH) / 2;

    const originX = Math.round((rect.x - offX) / scale);
    const originY = Math.round((rect.y - offY) / scale);
    const cropW = Math.round(rect.w / scale);
    const cropH = Math.round(rect.h / scale);

    manip.crop({
      originX: Math.max(0, originX),
      originY: Math.max(0, originY),
      width: Math.min(cropW, imageDims.w - Math.max(0, originX)),
      height: Math.min(cropH, imageDims.h - Math.max(0, originY)),
    });

    manip.renderAsync().then((imageRef: any) => {
      if (imageRef && typeof imageRef.saveAsync === "function") {
        return imageRef.saveAsync({ compress: 0.9, format: "jpeg" as any });
      }
      return { uri: capturedImage };
    }).then((result: { uri: string }) => {
      setCroppedUri(result.uri);
      setPhase("preview");
    }).catch(() => {
      setCroppedUri(capturedImage);
      setPhase("preview");
    });
  }

  function handleSkipCrop() {
    setCroppedUri(capturedImage);
    setPhase("preview");
  }

  async function handleSavePress() {
    const finalUri = croppedUri || capturedImage;
    if (!finalUri) return;

    setIsExtracting(true);
    try {
      const text = await extractTextFromImage(finalUri);
      setOcrText(text);
    } catch {
      setOcrText("");
    } finally {
      setIsExtracting(false);
    }

    if (preselectedPatient) {
      handleSelectPatient(preselectedPatient);
    } else {
      loadPatients();
      setPickerVisible(true);
    }
  }

  async function handleSelectPatient(patient: Patient) {
    const finalUri = croppedUri || capturedImage;
    if (!finalUri || !userId || saving) return;
    setPickerVisible(false);
    setSaving(true);
    try {
      const docsDir = new Directory(Paths.document, "documents");
      if (!docsDir.exists) {
        docsDir.create();
      }
      const filename = `doc_${patient.id}_${Date.now()}.jpg`;
      const destFile = new File(docsDir, filename);
      const srcFile = new File(finalUri);
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
            extractedText: ocrText ?? "",
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
      setCroppedUri(null);
      setImageDims(null);
      setPhase("camera");
      router.back();
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "Failed to save document.");
    } finally {
      setSaving(false);
    }
  }

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const frameWidth = Math.min(screenWidth - 48, 300);
  const frameHeight = Math.round(frameWidth * 1.41);

  // Phase: Crop
  if (phase === "crop" && capturedImage && imageDims) {
    return (
      <CropView
        imageUri={capturedImage}
        imageWidth={imageDims.w}
        imageHeight={imageDims.h}
        onApply={handleCropDone}
        onSkip={handleSkipCrop}
      />
    );
  }

  // Phase: Preview
  if (phase === "preview" && (croppedUri || capturedImage)) {
    const displayUri = croppedUri || capturedImage!;
    return (
      <View style={styles.screen}>
        <Image
          source={{ uri: displayUri }}
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

        {/* OCR Result Preview */}
        {ocrText !== null && ocrText.length > 0 && (
          <View style={styles.ocrBadge}>
            <MaterialIcons name="text-snippet" size={14} color="#10B981" />
            <Text style={styles.ocrBadgeText}>
              {ocrText.split("\n").filter((l: string) => l.trim()).length} lines extracted
            </Text>
          </View>
        )}

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
            style={[styles.saveBtn, (saving || isExtracting) && { opacity: 0.6 }]}
            disabled={saving || isExtracting}
          >
            {saving || isExtracting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.saveBtnText}>
              {isExtracting
                ? "Extracting text..."
                : saving
                  ? "Saving..."
                  : "Save Document"}
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

  // Phase: Camera
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

        <View
          style={[
            styles.docFrame,
            { width: frameWidth, height: frameHeight },
          ]}
        />

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
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.4)",
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
  cropBottomBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#000",
  },
  cropSkipBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
  },
  cropSkipText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  cropApplyBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
  },
  cropApplyText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
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
  ocrBadge: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
  },
  ocrBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#10B981",
  },
  previewBottomBar: {
    position: "absolute",
    bottom: 56,
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 16,
  },
  retakeBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  saveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
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
