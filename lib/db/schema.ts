export interface Patient {
  id: number;
  ownerId: string;
  name: string;
  dateAdded: string;
}

export interface Medication {
  id: number;
  ownerId: string;
  patientId: number | null;
  name: string;
  dosage: string;
  frequency: string;
  reminderEnabled: number;
  reminderTimes: string;
  reminderNotificationIds: string;
  dateAdded: string;
}

export interface PrescriptionDoctor {
  name?: string;
  specialty?: string;
  contact?: string;
  address?: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionAnalysis {
  summary: string;
  diagnosis?: string;
  date?: string;
  hospital?: string;
  patientName?: string;
  doctor?: PrescriptionDoctor;
  medicines: PrescriptionMedicine[];
}

export interface ScanRecord {
  id: number;
  medicationId: number;
  timestamp: string;
  rawBarcodeData: string;
}

export interface Document {
  id: number;
  ownerId: string;
  patientId: number;
  imageUri: string;
  title: string;
  extractedText: string;
  analysis: string | null;
  dateAdded: string;
}
