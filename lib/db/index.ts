export { initializeDatabase, getDatabase } from "./database";
export {
  addMedication,
  getAllMedications,
  getMedicationById,
  deleteMedication,
  addScan,
  getScansForMedication,
} from "./database";
export type { Medication, ScanRecord } from "./schema";
