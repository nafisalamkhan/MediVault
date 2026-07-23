export { initializeDatabase, getDatabase } from "./database";
export {
  addPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  addMedication,
  getAllMedications,
  getMedicationsByPatient,
  getMedicationById,
  deleteMedication,
  addScan,
  getScansForMedication,
  getScansByPatient,
  getUnclaimedMedications,
  claimMedications,
  addDocument,
  getDocumentsByPatient,
  deleteDocument,
} from "./database";
export type { Patient, Medication, ScanRecord, Document } from "./schema";
