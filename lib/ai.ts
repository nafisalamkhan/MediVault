import { File } from "expo-file-system";
import { ImageManipulator } from "expo-image-manipulator";
import type {
  ImageManipulatorContext,
  ImageRef,
} from "expo-image-manipulator";
import type {
  PrescriptionAnalysis,
  PrescriptionMedicine,
} from "@/lib/db/schema";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-flash-latest";

const MAX_IMAGE_DIM = 1280;
const REQUEST_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUSES = new Set([429, 408, 500, 503, 504]);
const RETRY_BACKOFF_BASE_MS = 1_000;
const RETRY_BACKOFF_MAX_MS = 8_000;
const RETRY_JITTER_MS = 250;

export function hasGeminiKey(): boolean {
  return Boolean(API_KEY);
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    diagnosis: { type: "STRING" },
    date: { type: "STRING" },
    hospital: { type: "STRING" },
    patientName: { type: "STRING" },
    doctor: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        specialty: { type: "STRING" },
        contact: { type: "STRING" },
        address: { type: "STRING" },
      },
    },
    medicines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          dosage: { type: "STRING" },
          frequency: { type: "STRING" },
          duration: { type: "STRING" },
          instructions: { type: "STRING" },
        },
      },
    },
  },
  required: ["summary", "diagnosis", "date", "hospital", "patientName", "medicines"],
};

function buildPrompt(text: string): string {
  const hint = text.trim()
    ? `\n\nOCR hint (may be noisy; prefer what you can read in the image):\n\`\`\`\n${text.slice(
        0,
        12000
      )}\n\`\`\``
    : "";
  return [
    "You are a careful medical transcription assistant.",
    "Read the medical prescription from the attached image and extract the details below.",
    "",
    "Return ONLY a single JSON object. Do not wrap it in markdown code fences. Do not add any text before or after the JSON. Use this exact shape:",
    '{ "summary": "...", "diagnosis": "...", "date": "YYYY-MM-DD", "hospital": "...", "patientName": "...", "doctor": { "name": "...", "specialty": "...", "contact": "...", "address": "..." }, "medicines": [ { "name": "...", "dosage": "...", "frequency": "...", "duration": "...", "instructions": "..." } ] }',
    "",
    "Field rules:",
    "- summary: a short plain-language explanation of what this prescription says and what the patient should know. If the prescription is mostly Bangla, write the summary in Bangla; otherwise write it in English.",
    "- doctor: the doctor's name, specialty, contact (phone), and address. Extract them from the image; use an empty string when not present.",
    "- diagnosis: the diagnosis or chief complaint if written.",
    "- date: the prescription date if present, formatted YYYY-MM-DD.",
    "- hospital: the hospital or clinic name if present.",
    "- patientName: the patient's name if written on the prescription.",
    "- medicines: one entry per distinct medicine. Never combine multiple medicines into a single entry. Keep every field a single short phrase: dosage (e.g. '500mg'), frequency (e.g. '1+0+1', 'twice daily'), duration (e.g. '7 days'), instructions (e.g. 'after meals'). Never write sentences, lists, or paragraphs. Omit a field that is not written on the prescription.",
    "",
    "Rules:",
    "- Only use information present in the image. Do not invent medicines, doses, or people.",
    "- Do not list the same medicine more than once.",
    "- If a field is unknown, omit it or use an empty string.",
    "- Do not give medical advice. The summary should describe what is written, not recommend treatment.",
    hint,
  ].join("\n");
}

async function readImageAsBase64(
  imageUri: string
): Promise<{ mimeType: string; data: string } | null> {
  let resizeContext: ImageManipulatorContext | null = null;
  let resizeRef: ImageRef | null = null;
  try {
    let uri = imageUri;
    const probeContext = ImageManipulator.manipulate(uri);
    let probe: ImageRef | null = null;
    try {
      probe = await probeContext.renderAsync();
      if (probe.width > MAX_IMAGE_DIM || probe.height > MAX_IMAGE_DIM) {
        const scale = MAX_IMAGE_DIM / Math.max(probe.width, probe.height);
        resizeContext = ImageManipulator.manipulate(uri);
        resizeRef = await resizeContext
          .resize({
            width: Math.round(probe.width * scale),
            height: Math.round(probe.height * scale),
          })
          .renderAsync();
        const saved = await resizeRef.saveAsync({
          compress: 0.8,
          format: "jpeg" as any,
        });
        uri = saved.uri;
      }
    } finally {
      probe?.release();
      probeContext.release();
    }
    const file = new File(uri);
    const data = await file.base64();
    return { mimeType: "image/jpeg", data };
  } catch (err) {
    console.warn("[AI] Failed to read image for analysis:", err);
    return null;
  } finally {
    resizeRef?.release();
    resizeContext?.release();
  }
}

function cleanField(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Only count another medicine's name as "contained" when it appears aligned to
// word/delimiter boundaries (spaces, commas, "+", etc.), so legitimate
// medicines whose names merely contain substrings of others (e.g.
// "Metronidazole" containing "Nidazol") are never hidden. Requiring at least
// three such names further spares common 2-component combination drugs (e.g.
// "Amoxicillin Clavulanate") while still catching the observed "one entry for
// everything" AI junk.
function containsAsWholeWord(haystack: string, needle: string): boolean {
  if (needle.length < 3) return false;
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9])${escapeRegExp(needle)}([^A-Za-z0-9]|$)`
  );
  return pattern.test(haystack);
}

export function filterCombinedMedicines<T extends { name: string }>(
  list: T[]
): T[] {
  if (list.length < 2) return list;
  const names = list.map((m) => m.name.toLowerCase());
  return list.filter((m) => {
    const lower = m.name.toLowerCase();
    const contained = names.filter(
      (n) => n !== lower && containsAsWholeWord(lower, n)
    );
    return contained.length < 3;
  });
}

function parseJson(text: string): PrescriptionAnalysis {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    cleaned = fence[1].trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  const raw = JSON.parse(cleaned) as Partial<PrescriptionAnalysis> & {
    medicines?: Array<Partial<PrescriptionMedicine>>;
  };

  const doctor = raw.doctor || {};
  const seenNames = new Set<string>();
  const medicines: PrescriptionMedicine[] = [];
  for (const m of Array.isArray(raw.medicines) ? raw.medicines : []) {
    const name = cleanField(m?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    medicines.push({
      name,
      dosage: cleanField(m.dosage),
      frequency: cleanField(m.frequency),
      duration: cleanField(m.duration),
      instructions: cleanField(m.instructions),
    });
  }

  return {
    summary: String(raw.summary || "").trim(),
    diagnosis: raw.diagnosis ? String(raw.diagnosis) : undefined,
    date: raw.date ? String(raw.date) : undefined,
    hospital: raw.hospital ? String(raw.hospital) : undefined,
    patientName: raw.patientName ? String(raw.patientName) : undefined,
    doctor: {
      name: doctor.name ? String(doctor.name) : undefined,
      specialty: doctor.specialty ? String(doctor.specialty) : undefined,
      contact: doctor.contact ? String(doctor.contact) : undefined,
      address: doctor.address ? String(doctor.address) : undefined,
    },
    medicines: filterCombinedMedicines(medicines),
  };
}

function buildRequestBody(
  parts: Array<Record<string, unknown>>,
  useSchema: boolean
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
  };
  if (useSchema) generationConfig.responseSchema = SCHEMA;
  return { contents: [{ parts }], generationConfig };
}

function waitBeforeRetry(attempt: number): Promise<void> {
  const exponential = RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1);
  const delay = Math.min(RETRY_BACKOFF_MAX_MS, exponential);
  const jitter = Math.floor(Math.random() * RETRY_JITTER_MS);
  return new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

function parseResponseEnvelope(raw: string): {
  textPart: string;
  finishReason: string;
} {
  const data = JSON.parse(raw);
  const textPart =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.[0]?.data ??
    "";
  return {
    textPart: String(textPart),
    finishReason: String(data?.candidates?.[0]?.finishReason ?? ""),
  };
}

export async function analyzePrescription({
  text,
  imageUri,
}: {
  text: string;
  imageUri?: string;
}): Promise<PrescriptionAnalysis | null> {
  if (!API_KEY) {
    console.warn("[AI] No EXPO_PUBLIC_GEMINI_API_KEY set.");
    return null;
  }
  const trimmed = (text || "").trim();
  if (!trimmed && !imageUri) return null;

  const parts: Array<Record<string, unknown>> = [];
  if (imageUri) {
    const image = await readImageAsBase64(imageUri);
    if (image) parts.push({ inlineData: image });
  }
  if (!trimmed && parts.length === 0) return null;
  parts.push({ text: buildPrompt(trimmed) });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": API_KEY,
  };

  // Retry with a schema-less request on later attempts: Gemini Flash can emit
  // truncated/malformed JSON when a complex responseSchema is set, which fails
  // JSON.parse with "Unexpected end of input".
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const useSchema = attempt === 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody(parts, useSchema)),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.warn(
          `[AI] Gemini request failed (attempt ${attempt}/${maxAttempts}):`,
          res.status,
          detail.slice(0, 500)
        );
        // Retry transient failures (rate limit, timeouts, server errors) across
        // the remaining attempts; other statuses fail fast.
        if (RETRYABLE_STATUSES.has(res.status) && attempt < maxAttempts) {
          await waitBeforeRetry(attempt);
          continue;
        }
        return null;
      }

      const raw = await res.text();
      if (!raw.trim()) {
        console.warn("[AI] Gemini returned an empty response body.");
        if (attempt < maxAttempts) continue;
        return null;
      }

      const { textPart, finishReason } = parseResponseEnvelope(raw);
      if (finishReason && finishReason !== "STOP") {
        console.warn("[AI] Gemini finished early:", finishReason);
      }
      if (!textPart.trim()) {
        console.warn("[AI] Gemini returned no content.");
        if (attempt < maxAttempts) continue;
        return null;
      }

      const analysis = parseJson(textPart);
      if (!analysis.summary && analysis.medicines.length === 0) {
        console.warn("[AI] Gemini returned an empty analysis.");
        if (attempt < maxAttempts) continue;
        return null;
      }
      return analysis;
    } catch (err) {
      console.warn(
        `[AI] Gemini call failed (attempt ${attempt}/${maxAttempts}):`,
        err
      );
      if (attempt === maxAttempts) return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
