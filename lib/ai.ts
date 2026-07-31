import type {
  PrescriptionAnalysis,
  PrescriptionMedicine,
} from "@/lib/db/schema";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-2.5-flash";

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
  required: ["summary", "medicines"],
};

function buildPrompt(text: string): string {
  return [
    "You are a careful medical transcription assistant.",
    "Below is the OCR text of a medical prescription (it may be in English, Bangla, or mixed).",
    "",
    "Extract and return JSON matching the provided schema.",
    "- summary: a short plain-language explanation of what this prescription says and what the patient should know. If the text is mostly Bangla, write the summary in Bangla; otherwise write it in English.",
    "- doctor: name, specialty, contact (phone), and address if present.",
    "- date: the prescription date if present, formatted YYYY-MM-DD.",
    "- medicines: every medicine mentioned, with dosage, frequency (e.g. '1+0+1', 'twice daily'), duration, and instructions if present.",
    "",
    "Rules:",
    "- Only use information present in the text. Do not invent medicines, doses, or people.",
    "- If a field is unknown, omit it or use an empty string.",
    "- Do not give medical advice. The summary should describe what is written, not recommend treatment.",
    "",
    "OCR text:",
    "```",
    text.slice(0, 12000),
    "```",
  ].join("\n");
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
  const raw = JSON.parse(cleaned) as Partial<PrescriptionAnalysis> & {
    medicines?: Array<Partial<PrescriptionMedicine>>;
  };

  const doctor = raw.doctor || {};
  const medicines = Array.isArray(raw.medicines)
    ? raw.medicines
        .filter((m) => m && typeof m.name === "string" && m.name.trim())
        .map((m) => ({
          name: String(m.name || "").trim(),
          dosage: m.dosage ? String(m.dosage) : undefined,
          frequency: m.frequency ? String(m.frequency) : undefined,
          duration: m.duration ? String(m.duration) : undefined,
          instructions: m.instructions ? String(m.instructions) : undefined,
        }))
    : [];

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
    medicines,
  };
}

export async function analyzePrescriptionText(
  text: string
): Promise<PrescriptionAnalysis | null> {
  if (!API_KEY) {
    console.warn("[AI] No EXPO_PUBLIC_GEMINI_API_KEY set.");
    return null;
  }
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(trimmed) }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
          },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[AI] Gemini request failed:", res.status, detail.slice(0, 500));
      return null;
    }

    const data = await res.json();
    const textPart =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0]?.data;
    if (!textPart) {
      console.warn("[AI] Gemini returned no content.");
      return null;
    }
    const analysis = parseJson(textPart);
    if (!analysis.summary && analysis.medicines.length === 0) {
      console.warn("[AI] Gemini returned empty analysis.");
      return null;
    }
    return analysis;
  } catch (err) {
    console.warn("[AI] Gemini call failed:", err);
    return null;
  }
}
