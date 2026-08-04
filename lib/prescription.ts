import type {
  PrescriptionAnalysis,
  PrescriptionMedicine,
} from "@/lib/db/schema";
import { analyzePrescription } from "@/lib/ai";
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
      // The schedule result carries the actual persisted notification IDs, so
      // surface cases where nothing could be scheduled despite derived times.
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

  for (const m of analysis.medicines) {
    if (!m.name) continue;
    const name = m.name.trim().toLowerCase();
    const isDuplicate =
      existing.some((e) => e.name.trim().toLowerCase() === name) ||
      createdNames.has(name);
    if (isDuplicate) continue;

    const medId = await createMedicationForMedicine({
      patientId,
      ownerId,
      medicine: m,
    }).catch((err) => {
      console.warn("[Prescription] Medication creation failed for", m.name, err);
      return null;
    });
    if (medId !== null) createdNames.add(name);
  }

  return analysis;
}
