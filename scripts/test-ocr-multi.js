const fs = require("fs");
const vm = require("vm");
const path = require("path");

async function gunzip(bytes) {
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function main() {
  const coreJs = fs.readFileSync(path.join(__dirname, "..", "assets/ocr/core.js.html"), "utf8");

  const sandbox = {
    console,
    WebAssembly,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    DataView,
    ArrayBuffer,
    Atomics,
    SharedArrayBuffer,
    setTimeout,
    clearTimeout,
    performance,
    crypto: require("crypto").webcrypto,
    Math,
    Date,
    JSON,
    Error,
    Promise,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.document = { currentScript: undefined };
  sandbox.fetch = (url) => {
    if (typeof url === "string" && url.startsWith("data:")) {
      const b64 = url.slice(url.indexOf(",") + 1);
      const bytes = Buffer.from(b64, "base64");
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      });
    }
    return globalThis.fetch(url);
  };
  vm.createContext(sandbox);
  vm.runInContext(coreJs, sandbox);

  if (typeof sandbox.TesseractCore !== "function") {
    throw new Error("TesseractCore factory not found");
  }

  const [eng, ben] = await Promise.all([
    gunzip(fs.readFileSync(path.join(__dirname, "..", "assets/ocr/eng.traineddata.gz"))),
    gunzip(fs.readFileSync(path.join(__dirname, "..", "assets/ocr/ben.traineddata.gz"))),
  ]);
  console.log("eng raw bytes:", eng.length);
  console.log("ben raw bytes:", ben.length);

  const mod = await sandbox.TesseractCore({ TesseractProgress() {} });
  mod.FS.writeFile("/eng.traineddata", eng);
  mod.FS.writeFile("/ben.traineddata", ben);
  const api = new mod.TessBaseAPI();
  const oem = typeof mod.OEM_LSTM_ONLY === "number" ? mod.OEM_LSTM_ONLY : 1;
  const status = api.Init(null, "eng+ben", oem, null);
  console.log("Init(eng+ben) status:", status);
  if (status === -1) {
    console.log("tessdata dir listing:", mod.FS.readdir("."));
    process.exit(1);
  }

  const img = new Uint8Array(64 * 64 * 4);
  mod.FS.writeFile("/input", img);
  api.SetImageFile(1, 0);
  api.Recognize(null);
  const text = api.GetUTF8Text() || "";
  api.End();
  console.log("Recognition pipeline OK, text length:", text.length);
  console.log("MULTI-LANG OCR OK");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
