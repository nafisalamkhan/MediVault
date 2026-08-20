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
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useAuth } from "@clerk/clerk-expo";
import { Text, GlassPanel } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors, radius, fonts } from "@/lib/theme";
import {
  initializeDatabase,
  getAllPatients,
  getPatientById,
  addDocument,
} from "@/lib/db";
import type { Patient } from "@/lib/db/schema";
import { processPrescription } from "@/lib/prescription";

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
  onRotate,
  rotating,
}: {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (rect: CropRect) => void;
  onSkip: () => void;
  onRotate: () => void;
  rotating: boolean;
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
  const cropRef = useRef(crop);
  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);
  const dragRef = useRef<{ corner: string; startX: number; startY: number; orig: CropRect } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, gesture) => {
        const px = gesture.x0;
        const py = gesture.y0;
        const cur = cropRef.current;
        let corner = "body";
        const corners = [
          { name: "tl", cx: cur.x, cy: cur.y },
          { name: "tr", cx: cur.x + cur.w, cy: cur.y },
          { name: "bl", cx: cur.x, cy: cur.y + cur.h },
          { name: "br", cx: cur.x + cur.w, cy: cur.y + cur.h },
        ];
        for (const c of corners) {
          if (Math.abs(px - c.cx) < 30 && Math.abs(py - c.cy) < 30) {
            corner = c.name;
            break;
          }
        }
        if (corner === "body") {
          const inside =
            px >= cur.x &&
            px <= cur.x + cur.w &&
            py >= cur.y &&
            py <= cur.y + cur.h;
          if (!inside) corner = "br";
        }
        dragRef.current = {
          corner,
          startX: px,
          startY: py,
          orig: { ...cur },
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
    <View style={styles.darkScreen}>
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
        <View
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y,
            width: crop.w,
            height: crop.h,
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: imageUri }}
            style={{
              position: "absolute",
              left: offX - crop.x,
              top: offY - crop.y,
              width: dispW,
              height: dispH,
            }}
            resizeMode="contain"
          />
        </View>
        {/* Crop border */}
        <View
          style={{
            position: "absolute",
            left: crop.x,
            top: crop.y,
            width: crop.w,
            height: crop.h,
            borderWidth: 2,
            borderColor: colors.white,
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
              backgroundColor: colors.white,
            }}
          />
        ))}
      </View>

      {/* Bottom bar */}
      <View style={styles.cropBottomBar}>
        <TouchableOpacity onPress={onSkip} style={styles.cropSkipBtn} activeOpacity={0.7}>
          <Text style={styles.cropSkipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRotate}
          style={styles.cropRotateBtn}
          disabled={rotating}
          activeOpacity={0.7}
        >
          <MaterialIcons name="rotate-right" size={18} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onApply(crop)}
          style={styles.cropApplyBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="crop" size={18} color={colors.white} />
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
  const [rotatedUri, setRotatedUri] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [preselectedPatient, setPreselectedPatient] = useState<Patient | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [savedDoc, setSavedDoc] = useState<{ docId: number; patientId: number; imageUri: string } | null>(null);
  const [showAIAnalysisPrompt, setShowAIAnalysisPrompt] = useState(false);

  function TorchButton({ on, onPress }: { on: boolean; onPress: () => void }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.torchBtn, on && styles.torchBtnActive]}
        activeOpacity={0.7}
        accessibilityLabel={on ? "Turn off flash" : "Turn on flash"}
        accessibilityRole="button"
        hitSlop={8}
      >
        <MaterialIcons name={on ? "flash-on" : "flash-off"} size={24} color={colors.white} />
      </TouchableOpacity>
    );
  }

  const displayUri = rotatedUri ?? capturedImage;
  const displayDims = imageDims && rotation % 2 === 1
    ? { w: imageDims.h, h: imageDims.w }
    : imageDims;

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 32 }]}>
        <View style={styles.permissionCard}>
          <MaterialIcons name="camera-alt" size={64} color={colors.hairline} />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permDesc}>
            MediVault needs access to your camera to capture medical documents
            and prescriptions.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={styles.permBtnPrimary}
            activeOpacity={0.8}
          >
            <Text style={styles.permBtnPrimaryText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.permBtnSecondary}
            activeOpacity={0.7}
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
        try {
          const probe = await ImageManipulator.manipulate(photo.uri).renderAsync();
          setImageDims({ w: probe.width, h: probe.height });
          setPhase("crop");
        } catch {
          Image.getSize(
            photo.uri,
            (w: number, h: number) => {
              setImageDims({ w, h });
              setPhase("crop");
            },
            () => {
              setCroppedUri(photo.uri);
              setPhase("preview");
            }
          );
        }
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
    setRotatedUri(null);
    setRotation(0);
    setPhase("camera");
  }

  async function handleRotate() {
    if (!capturedImage || !imageDims || rotating) return;
    setRotating(true);
    try {
      const next = (rotation + 1) % 4;
      const ref = await ImageManipulator.manipulate(capturedImage)
        .rotate(90 * next)
        .renderAsync();
      const saved = await ref.saveAsync({
        compress: 0.9,
        format: SaveFormat.JPEG,
      });
      setRotatedUri(saved.uri);
      setRotation(next);
    } catch {
      showToast("Could not rotate image.", "error");
    } finally {
      setRotating(false);
    }
  }

  function handleCropDone(rect: CropRect) {
    if (!displayUri || !displayDims) {
      setPhase("preview");
      return;
    }
    const manip = ImageManipulator.manipulate(displayUri);
    const viewW = SCREEN_W;
    const viewH = SCREEN_H - 120;
    const scale = Math.min(viewW / displayDims.w, viewH / displayDims.h);
    const dispW = displayDims.w * scale;
    const dispH = displayDims.h * scale;
    const offX = (viewW - dispW) / 2;
    const offY = (viewH - dispH) / 2;

    const originX = Math.round((rect.x - offX) / scale);
    const originY = Math.round((rect.y - offY) / scale);
    const cropW = Math.round(rect.w / scale);
    const cropH = Math.round(rect.h / scale);

    manip.crop({
      originX: Math.max(0, originX),
      originY: Math.max(0, originY),
      width: Math.min(cropW, displayDims.w - Math.max(0, originX)),
      height: Math.min(cropH, displayDims.h - Math.max(0, originY)),
    });

    manip.renderAsync().then((imageRef: any) => {
      if (imageRef && typeof imageRef.saveAsync === "function") {
        return imageRef.saveAsync({
          compress: 0.9,
          format: SaveFormat.JPEG,
        });
      }
      return { uri: displayUri };
    }).then((result: { uri: string }) => {
      setCroppedUri(result.uri);
      setPhase("preview");
    }).catch(() => {
      setCroppedUri(displayUri);
      setPhase("preview");
    });
  }

  function handleSkipCrop() {
    setCroppedUri(displayUri);
    setPhase("preview");
  }

  function handleSavePress() {
    const finalUri = croppedUri || displayUri;
    if (!finalUri) return;

    if (preselectedPatient) {
      handleSelectPatient(preselectedPatient);
    } else {
      loadPatients();
      setPickerVisible(true);
    }
  }

  async function handleSelectPatient(patient: Patient) {
    const finalUri = croppedUri || displayUri;
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
      let savedDocId = -1;
      try {
        await initializeDatabase();
        savedDocId = await addDocument(
          {
            ownerId: userId,
            patientId: patient.id,
            imageUri: destFile.uri,
            title: filename,
            extractedText: "",
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

      // Store saved document info and show AI analysis prompt
      setSavedDoc({ docId: savedDocId, patientId: patient.id, imageUri: destFile.uri });
      setShowAIAnalysisPrompt(true);

      setCapturedImage(null);
      setCroppedUri(null);
      setImageDims(null);
      setRotatedUri(null);
      setRotation(0);
      // Don't reset phase - stay in preview to show AI prompt
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
  if (phase === "crop" && displayUri && displayDims) {
    return (
      <CropView
        key={rotation}
        imageUri={displayUri}
        imageWidth={displayDims.w}
        imageHeight={displayDims.h}
        onApply={handleCropDone}
        onSkip={handleSkipCrop}
        onRotate={handleRotate}
        rotating={rotating}
      />
    );
  }

  // Phase: Preview
  if (phase === "preview" && displayUri) {
    const previewUri = croppedUri || displayUri;
    return (
      <View style={styles.darkScreen}>
        <Image
          source={{ uri: previewUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="contain"
          accessibilityLabel="Captured document preview"
        />

        <View style={styles.previewTopBar}>
          <TouchableOpacity
            onPress={handleRetake}
            style={styles.circleBtn}
            accessibilityLabel="Discard photo"
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={24} color={colors.white} />
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
            <MaterialIcons name="refresh" size={20} color={colors.white} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSavePress}
            activeOpacity={0.8}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <MaterialIcons name="check" size={20} color={colors.white} />
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
            <GlassPanel style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Save to Patient
              </Text>
              <Text style={styles.modalDesc}>
                Choose a patient folder for this document.
              </Text>
              {patients.length === 0 ? (
                <View
                  style={styles.emptyPicker}
                >
                  <MaterialIcons name="folder-open" size={40} color={colors.hairline} />
                  <Text style={styles.emptyPickerText}>
                    No patients yet. Add a patient from the Home tab first.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={patients}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.patientList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectPatient(item)}
                      style={styles.patientRow}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <View style={styles.patientAvatar}>
                        <MaterialIcons name="person" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.patientName}>{item.name}</Text>
                      <MaterialIcons
                        name="chevron-right"
                        size={18}
                        color={colors.hairline}
                      />
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={styles.cancelBtn}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </GlassPanel>
          </View>
        </Modal>

        {/* AI Analysis Prompt Modal */}
        <Modal
          visible={showAIAnalysisPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAIAnalysisPrompt(false);
            setSavedDoc(null);
            setPhase("camera");
            router.back();
          }}
        >
          <View style={styles.modalOverlay}>
            <GlassPanel style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Document Saved!
              </Text>
              <Text style={styles.modalDesc}>
                Want to analyze this document with AI to extract medications and get a prescription summary?
              </Text>
              <View style={styles.aiPromptActions}>
                <TouchableOpacity
                  onPress={() => {
                    if (!savedDoc) return;
                    setShowAIAnalysisPrompt(false);
                    // Navigate to document detail with auto-analyze trigger
                    router.push({
                      pathname: "/document/[id]",
                      params: { id: String(savedDoc.docId), autoAnalyze: "true" },
                    });
                  }}
                  style={styles.aiAnalyzeBtn}
                  activeOpacity={0.8}
                  accessibilityLabel="Analyze with AI"
                >
                  <MaterialIcons name="auto-awesome" size={20} color={colors.white} />
                  <Text style={styles.aiAnalyzeBtnText}>Analyze with AI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowAIAnalysisPrompt(false);
                    setSavedDoc(null);
                    setPhase("camera");
                    router.back();
                  }}
                  style={styles.aiLaterBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Analyze later"
                >
                  <Text style={styles.aiLaterBtnText}>Do It Later</Text>
                </TouchableOpacity>
              </View>
            </GlassPanel>
          </View>
        </Modal>
      </View>
    );
  }

  // Phase: Camera
  return (
    <View style={styles.darkScreen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        mode="picture"
        enableTorch={torchOn}
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Overlay */}
      <View style={styles.cameraOverlay}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Close camera"
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={24} color={colors.white} />
        </TouchableOpacity>

        <TorchButton
          on={torchOn}
          onPress={() => setTorchOn((prev) => !prev)}
        />

        <View
          style={[
            styles.docFrame,
            { width: frameWidth, height: frameHeight },
          ]}
        >
          {/* Corner brackets for edge guidance */}
          <View style={styles.cornerBracket} />
          <View style={[styles.cornerBracket, styles.cornerBracketTR]} />
          <View style={[styles.cornerBracket, styles.cornerBracketBL]} />
          <View style={[styles.cornerBracket, styles.cornerBracketBR]} />
          {/* Center crosshair */}
          <View style={styles.crosshair}>
            <View style={styles.crosshairLine} />
            <View style={styles.crosshairLine} />
          </View>
        </View>

        <Text style={styles.instructionText}>
          Align document edges with corner brackets
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
            <ActivityIndicator size="large" color={colors.white} />
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
  darkScreen: {
    flex: 1,
    backgroundColor: colors.surfaceBlack,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasParchment,
  },
  permissionCard: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 32,
  },
  permTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    textAlign: "center",
  },
  permDesc: {
    marginTop: 8,
    fontSize: 14,
    color: colors.inkTertiary,
    textAlign: "center",
  },
  permBtnPrimary: {
    marginTop: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permBtnPrimaryText: { color: colors.white, fontWeight: "600", fontFamily: fonts.semibold },
  permBtnSecondary: {
    marginTop: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permBtnSecondaryText: { color: colors.inkMuted80, fontWeight: "600", fontFamily: fonts.semibold },
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
    borderRadius: radius.lg,
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
    fontFamily: fonts.medium,
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
    borderColor: colors.white,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  shutterInner: {
    height: 64,
    width: 64,
    borderRadius: 999,
    backgroundColor: colors.white,
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
    backgroundColor: colors.surfaceBlack,
  },
  cropSkipBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
  },
  cropSkipText: { fontSize: 15, fontWeight: "600", color: colors.white, fontFamily: fonts.semibold },
  cropRotateBtn: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cropApplyBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  cropApplyText: { fontSize: 15, fontWeight: "600", color: colors.white, fontFamily: fonts.semibold },
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
    fontFamily: fonts.medium,
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
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 16,
  },
  retakeBtnText: { fontSize: 15, fontWeight: "600", color: colors.white, fontFamily: fonts.semibold },
  saveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: colors.white, fontFamily: fonts.semibold },
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
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    marginBottom: 4,
    letterSpacing: -0.374,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.inkTertiary,
    marginBottom: 16,
  },
  emptyPicker: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyPickerText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.inkTertiary,
    textAlign: "center",
  },
  patientList: {
    maxHeight: 300,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 4,
    backgroundColor: colors.surfacePearl,
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  patientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.ink,
    fontFamily: fonts.medium,
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
  },
  torchBtn: {
    position: "absolute",
    right: 16,
    top: 56,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
  },
  torchBtnActive: {
    backgroundColor: colors.primary,
  },
  cornerBracket: {
    position: "absolute",
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: colors.white,
  },
  cornerBracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopColor: colors.white,
    borderRightColor: colors.white,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  cornerBracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomColor: colors.white,
    borderLeftColor: colors.white,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  cornerBracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomColor: colors.white,
    borderRightColor: colors.white,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  crosshair: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  crosshairLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  aiPromptActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  aiAnalyzeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  aiAnalyzeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  aiLaterBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
    paddingVertical: 16,
  },
  aiLaterBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
  },
});
