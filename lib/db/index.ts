export { initializeDatabase, getDatabase } from "./database";
export {
  addMedication,
  getAllMedications,
  getMedicationById,
  deleteMedication,
  addScan,
  getScansForMedication,
  getUnclaimedMedications,
  claimMedications,
} from "./database";
export type { Medication, ScanRecord } from "./schema";
