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
    } catch {
      nativeAvailable = false;
    }
  }

  if (!nativeAvailable) return "";

  try {
    if (!cachedModule) {
      cachedModule = await import(
        "@infinitered/react-native-mlkit-text-recognition"
      );
    }
    const result = await cachedModule.recognizeText(imageUri);
    return result.text || "";
  } catch {
    return "";
  }
}
