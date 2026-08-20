import type {
  PrescriptionAnalysis,
  PrescriptionMedicine,
} from "@/lib/db/schema";
import { analyzePrescription, normalizeMedicineName } from "@/lib/ai";
import {
  updateDocumentAnalysis,
  getMedicationsByPatient,
  getMedicationById,
  addMedication,
} from "@/lib/db";
import { deriveReminderTimes, scheduleMedicationReminder } from "@/lib/notifications";

export async function createMedicationForMedicine({
  patientId,
  ownerId,
  medicine,
}: {
  patientId: number;
  ownerId: string;
  medicine: PrescriptionMedicine;
}): Promise<number | null> {
  if (!medicine.name) return null;

  const times = deriveReminderTimes(medicine.frequency || "");
  const medId = await addMedication(
    {
      patientId,
      name: medicine.name,
      dosage: medicine.dosage ?? "",
      frequency: medicine.frequency ?? "",
      instructions: medicine.instructions ?? "",
      reminderEnabled: 0,
      reminderTimes: JSON.stringify(times),
      reminderNotificationIds: "[]",
    },
    ownerId
  );

  if (times.length > 0) {
    const medRow = await getMedicationById(medId, ownerId);
    if (medRow) {
      const schedule = await scheduleMedicationReminder(
        medRow,
        ownerId
      ).catch((err) => {
        console.warn(
          "[Prescription] Reminder schedule failed for",
          medicine.name,
          err
        );
        return null;
      });
      if (schedule && !schedule.enabled && schedule.times.length === 0) {
        console.warn(
          "[Prescription] No reminders were scheduled for",
          medicine.name
        );
      }
    }
  }

  return medId;
}

export async function processPrescription({
  docId,
  patientId,
  ownerId,
  text,
  imageUri,
}: {
  docId: number;
  patientId: number;
  ownerId: string;
  text: string;
  imageUri?: string;
}): Promise<PrescriptionAnalysis | null> {
  if (!text?.trim() && !imageUri) return null;

  const analysis = await analyzePrescription({ text, imageUri });
  if (!analysis) return null;

  await updateDocumentAnalysis(docId, ownerId, JSON.stringify(analysis));

  const existing = await getMedicationsByPatient(patientId, ownerId);
  const createdNames = new Set<string>();
  const existingKeys = new Set(existing.map((e) => normalizeMedicineName(e.name)));

  for (const m of analysis.medicines) {
    if (!m.name) continue;
    const key = normalizeMedicineName(m.name);
    if (!key || existingKeys.has(key) || createdNames.has(key)) continue;

    const medId = await createMedicationForMedicine({
      patientId,
      ownerId,
      medicine: m,
    }).catch((err) => {
      console.warn("[Prescription] Medication creation failed for", m.name, err);
      return null;
    });
    if (medId !== null) {
      createdNames.add(key);
    }
  }

  return analysis;
}