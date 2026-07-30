import { requireOptionalNativeModule } from "expo-modules-core";

let cachedModule: {
  recognizeText: (uri: string) => Promise<{ text: string }>;
} | null = null;
let nativeAvailable: boolean | null = null;

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (nativeAvailable === null) {
    try {
      nativeAvailable =
        requireOptionalNativeModule("RNMLKitTextRecognition") !== null;
    } catch (e) {
      console.warn("[OCR] Native module check failed:", e);
      nativeAvailable = false;
    }
  }

  if (!nativeAvailable) return "";

  if (!cachedModule) {
    try {
      cachedModule = await import(
        "@infinitered/react-native-mlkit-text-recognition"
      );
    } catch (e) {
      console.warn("[OCR] Failed to import ML Kit module:", e);
      return "";
    }
  }

  try {
    const result = await cachedModule.recognizeText(imageUri);
    return result.text || "";
  } catch (e) {
    console.warn("[OCR] Text recognition failed for", imageUri, e);
    return "";
  }
}
