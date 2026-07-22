import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const BARCODE_TYPES = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "qr",
] as const;

export default function Scanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanned, setIsScanned] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
        <Text className="mt-4 text-center text-lg font-semibold text-gray-800">
          Camera Permission Required
        </Text>
        <Text className="mt-2 text-center text-sm text-gray-500">
          MediVault needs access to your camera to scan medication barcodes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="mt-6 rounded-xl bg-blue-600 px-8 py-3.5"
        >
          <Text className="font-semibold text-white">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-xl bg-gray-200 px-8 py-3.5"
        >
          <Text className="font-semibold text-gray-800">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (isScanned) return;
    setIsScanned(true);
    setScannedData(data);
  }

  function handleScanAgain() {
    setIsScanned(false);
    setScannedData(null);
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={isScanned ? undefined : handleBarcodeScanned}
      />

      {/* Targeting Reticle Overlay */}
      <View className="absolute inset-0 items-center justify-center">
        {/* Top Close Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-4 top-12 rounded-full bg-black/50 p-3"
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Reticle Frame */}
        <View className="h-64 w-64 items-center justify-center">
          {/* Top-Left Corner */}
          <View className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-blue-500" />
          {/* Top-Right Corner */}
          <View className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-blue-500" />
          {/* Bottom-Left Corner */}
          <View className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-blue-500" />
          {/* Bottom-Right Corner */}
          <View className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-blue-500" />
        </View>

        {/* Instruction Text */}
        <Text className="absolute bottom-40 text-sm font-medium text-white/80">
          Point camera at a barcode
        </Text>
      </View>

      {/* Scanned Result Overlay */}
      {isScanned && scannedData && (
        <View className="absolute inset-0 items-center justify-center bg-black/80 px-8">
          <View className="w-full rounded-2xl bg-white p-6">
            <Text className="mb-2 text-sm font-medium text-gray-500">
              Barcode Detected
            </Text>
            <Text
              className="text-lg font-bold text-gray-900"
              selectable
            >
              {scannedData}
            </Text>
            <View className="mt-6 flex-row gap-3">
              <TouchableOpacity
                onPress={handleScanAgain}
                className="flex-1 rounded-xl bg-gray-200 py-3.5"
              >
                <Text className="text-center font-semibold text-gray-800">
                  Scan Again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.back()}
                className="flex-1 rounded-xl bg-blue-600 py-3.5"
              >
                <Text className="text-center font-semibold text-white">
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
