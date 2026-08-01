import { useEffect, useState } from "react";
import type {
  ComponentProps,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

type OcrWebViewRef = {
  postMessage: (data: string) => void;
};

type PendingRequest = {
  resolve: (text: string) => void;
};

type BootHandlers = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

const BOOT_TIMEOUT_MS = 180000;
const RECOGNIZE_TIMEOUT_MS = 180000;
const MAX_UPLOAD_BYTES = 3_000_000;

const OCR_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<script>
/*__CORE_JS__*/
</script>
<script type="text/plain" id="ocr-data">
/*__DATA_B64__*/
</script>
<script type="text/plain" id="ocr-data-ben">
/*__DATA_BEN_B64__*/
</script>
<script>
/*__BOOTSTRAP_JS__*/
</script>
</body>
</html>`;

const BOOTSTRAP_JS = `(function () {
  function post(type, payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
    } catch (e) {}
  }
  function decodeBase64(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  function gunzip(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This device does not support the gzip API required for OCR.');
    }
    var ds = new DecompressionStream('gzip');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }
  function getExif(bytes) {
    var s = '';
    var n = Math.min(bytes.length, 500);
    for (var i = 0; i < n; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    var m = s.match(/1 18 0 3 0 0 0 1 0 (\\d)/);
    return m ? parseInt(m[1], 10) || 1 : 1;
  }

  post('status', { stage: 'decoding' });
  var langs = [
    { id: 'ocr-data', file: '/eng.traineddata', lang: 'eng' },
    { id: 'ocr-data-ben', file: '/ben.traineddata', lang: 'ben' }
  ];
  Promise.all(langs.map(function (l) {
    return gunzip(decodeBase64(document.getElementById(l.id).textContent.trim()));
  })).then(function (traineddatas) {
    post('status', { stage: 'core' });
    if (typeof window.TesseractCore !== 'function') {
      throw new Error('Tesseract core failed to load.');
    }
    return window.TesseractCore({ TesseractProgress: function () {} }).then(function (mod) {
      post('status', { stage: 'init' });
      for (var i = 0; i < langs.length; i++) {
        mod.FS.writeFile(langs[i].file, traineddatas[i]);
      }
      var api = new mod.TessBaseAPI();
      var oem = typeof mod.OEM_LSTM_ONLY === 'number' ? mod.OEM_LSTM_ONLY : 1;
      if (api.Init(null, 'eng+ben', oem, null) === -1) {
        api.End();
        throw new Error('Tesseract failed to initialize with English and Bangla language data.');
      }
      window.__ocr = { mod: mod, api: api };
      post('ready', {});
    });
  }).catch(function (err) {
    post('error', { message: String((err && err.message) || err) });
  });

  var completedRequests = {};
  function onMessage(e) {
    var raw = e && e.data;
    if (typeof raw !== 'string') return;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!data || data.type !== 'recognize') return;
    if (completedRequests[data.requestId]) return;
    try {
      var ocr = window.__ocr;
      if (!ocr) throw new Error('OCR engine is not initialized.');
      var imageBytes = decodeBase64(data.imageB64);
      ocr.mod.FS.writeFile('/input', imageBytes);
      if (ocr.api.SetImageFile(getExif(imageBytes), 0) === 1) {
        throw new Error('Could not read the image for OCR.');
      }
      ocr.api.Recognize(null);
      post('result', { requestId: data.requestId, text: ocr.api.GetUTF8Text() || '' });
    } catch (err) {
      post('error', { requestId: data.requestId, message: String((err && err.message) || err) });
    }
    completedRequests[data.requestId] = true;
  }
  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
})();`;

const OcrWebViewComponent = WebView as unknown as ForwardRefExoticComponent<
  ComponentProps<typeof WebView> & RefAttributes<OcrWebViewRef>
>;

let webViewRef: OcrWebViewRef | null = null;
let booted = false;
let bootError: Error | null = null;
let bootHandlers: BootHandlers | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();
let reloadHandler: (() => void) | null = null;

function failBoot(error: Error) {
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
  if (bootHandlers) {
    bootHandlers.reject(error);
    bootHandlers = null;
  }
  pendingRequests.forEach((request) => request.resolve(""));
  pendingRequests.clear();

  if (booted) {
    booted = false;
    webViewRef = null;
    const handler = reloadHandler;
    if (handler) handler();
  } else if (!bootError) {
    bootError = error;
  }
}

function waitForReady(): Promise<void> {
  if (booted) return Promise.resolve();
  if (bootError) return Promise.reject(bootError);
  if (bootHandlers) return bootHandlers.promise;

  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  bootHandlers = { promise, resolve, reject };
  bootTimer = setTimeout(() => {
    failBoot(new Error("OCR engine did not become ready in time."));
  }, BOOT_TIMEOUT_MS);
  return promise;
}

function handleMessage(raw: string) {
  let data: {
    type?: string;
    requestId?: number;
    text?: string;
    message?: string;
    stage?: string;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data || typeof data.type !== "string") return;

  if (data.type === "ready") {
    booted = true;
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }
    const handlers = bootHandlers;
    bootHandlers = null;
    if (handlers) {
      handlers.resolve();
    }
  } else if (data.type === "result") {
    const request =
      data.requestId != null ? pendingRequests.get(data.requestId) : undefined;
    if (request) {
      pendingRequests.delete(data.requestId as number);
      request.resolve(data.text || "");
    }
  } else if (data.type === "status") {
    console.warn("[OCR] Boot stage:", data.stage);
  } else if (data.type === "error") {
    const request =
      data.requestId != null ? pendingRequests.get(data.requestId) : undefined;
    if (request) {
      pendingRequests.delete(data.requestId as number);
      request.resolve("");
    } else {
      console.warn("[OCR] Engine error:", data.message);
      failBoot(new Error(data.message || "OCR engine error."));
    }
  }
}

async function readAssetText(moduleId: number | string): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("OCR asset could not be downloaded.");
  }
  return new File(asset.localUri).text();
}

async function readAssetBase64(moduleId: number | string): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("OCR asset could not be downloaded.");
  }
  return new File(asset.localUri).base64();
}

async function buildOcrHtml(): Promise<string> {
  const [coreJs, engB64, benB64] = await Promise.all([
    readAssetText(require("@/assets/ocr/core.js.html")),
    readAssetBase64(require("@/assets/ocr/eng.traineddata.gz")),
    readAssetBase64(require("@/assets/ocr/ben.traineddata.gz")),
  ]);
  return OCR_HTML_TEMPLATE.replace("/*__CORE_JS__*/", () => coreJs)
    .replace("/*__DATA_B64__*/", () => engB64)
    .replace("/*__DATA_BEN_B64__*/", () => benB64)
    .replace("/*__BOOTSTRAP_JS__*/", () => BOOTSTRAP_JS);
}

async function readImageAsBase64(uri: string): Promise<string> {
  let target = uri;
  const original = new File(uri);
  if (original.exists && original.size > MAX_UPLOAD_BYTES) {
    try {
      const context = ImageManipulator.manipulate(uri).resize({ width: 2048 });
      const ref = await context.renderAsync();
      const saved = await ref.saveAsync({
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      target = saved.uri;
    } catch {
      target = uri;
    }
  }
  const file = new File(target);
  if (!file.exists) {
    throw new Error("Image file does not exist.");
  }
  return file.base64();
}

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (!webViewRef) {
    console.warn("[OCR] OCR WebView is not mounted.");
    return "";
  }
  try {
    await waitForReady();
  } catch (error) {
    console.warn("[OCR] Engine not ready:", error);
    return "";
  }
  try {
    const imageB64 = await readImageAsBase64(imageUri);
    const requestId = ++nextRequestId;
    const result = new Promise<string>((resolve) => {
      pendingRequests.set(requestId, { resolve });
    });
    const timer = setTimeout(() => {
      const request = pendingRequests.get(requestId);
      if (request) {
        pendingRequests.delete(requestId);
        request.resolve("");
      }
    }, RECOGNIZE_TIMEOUT_MS);
    try {
      webViewRef.postMessage(
        JSON.stringify({ type: "recognize", requestId, imageB64 })
      );
      return await result;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.warn("[OCR] Recognition request failed:", error);
    return "";
  }
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: -4,
    top: -4,
    width: 2,
    height: 2,
    overflow: "hidden",
  },
  webview: {
    width: 2,
    height: 2,
    backgroundColor: "#ffffff",
  },
});

export function OcrWebView() {
  const [html, setHtml] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    reloadHandler = () => setEpoch((e) => e + 1);
    buildOcrHtml()
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch((error: unknown) => {
        console.warn("[OCR] Failed to build OCR page:", error);
        failBoot(new Error("Failed to build OCR page."));
      });
    return () => {
      cancelled = true;
      reloadHandler = null;
      webViewRef = null;
    };
  }, []);

  if (html === null) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <OcrWebViewComponent
        key={epoch}
        ref={(node) => {
          if (node) webViewRef = node;
        }}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        textZoom={100}
        setSupportMultipleWindows={false}
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
        onError={(event) => {
          console.warn("[OCR] WebView error:", event.nativeEvent.description);
          failBoot(new Error("OCR WebView failed to load."));
        }}
        onContentProcessDidTerminate={() => {
          failBoot(new Error("OCR WebView terminated."));
        }}
        onRenderProcessGone={() => {
          failBoot(new Error("OCR WebView process was killed."));
        }}
        style={styles.webview}
      />
    </View>
  );
}
