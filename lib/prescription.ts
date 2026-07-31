import type {
  PrescriptionAnalysis,
  PrescriptionMedicine,
} from "@/lib/db/schema";
import { analyzePrescriptionText } from "@/lib/ai";
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
      await scheduleMedicationReminder(medRow, ownerId).catch((err) =>
        console.warn(
          "[Prescription] Reminder schedule failed for",
          medicine.name,
          err
        )
      );
    }
  }

  return medId;
}

export async function processPrescription({
  docId,
  patientId,
  ownerId,
  text,
}: {
  docId: number;
  patientId: number;
  ownerId: string;
  text: string;
}): Promise<PrescriptionAnalysis | null> {
  if (!text || !text.trim()) return null;

  const analysis = await analyzePrescriptionText(text);
  if (!analysis) return null;

  await updateDocumentAnalysis(docId, ownerId, JSON.stringify(analysis));

  const existing = await getMedicationsByPatient(patientId, ownerId);

  for (const m of analysis.medicines) {
    if (!m.name) continue;
    const isDuplicate = existing.some(
      (e) => e.name.trim().toLowerCase() === m.name!.trim().toLowerCase()
    );
    if (isDuplicate) continue;

    await createMedicationForMedicine({
      patientId,
      ownerId,
      medicine: m,
    }).catch((err) =>
      console.warn("[Prescription] Medication creation failed for", m.name, err)
    );
  }

  return analysis;
}
