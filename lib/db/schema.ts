export interface Medication {
  id: number;
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
