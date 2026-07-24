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
  dateAdded: string;
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
  dateAdded: string;
}
