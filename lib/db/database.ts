import * as SQLite from "expo-sqlite";
import { File, Paths, Directory } from "expo-file-system";
import type { Patient, Medication, ScanRecord, Document } from "./schema";

const DB_NAME = "medivault.db";

let db: SQLite.SQLiteDatabase;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const database = getDatabase();

  await database.execAsync("PRAGMA foreign_keys = ON;");

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      dateAdded TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerId TEXT NOT NULL,
      patientId INTEGER,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      dateAdded TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicationId INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      rawBarcodeData TEXT NOT NULL,
      FOREIGN KEY (medicationId) REFERENCES medications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerId TEXT NOT NULL,
      patientId INTEGER NOT NULL,
      imageUri TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      extractedText TEXT NOT NULL DEFAULT '',
      dateAdded TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // Migration: add extractedText to documents table if missing.
  const docColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(documents)"
  );
  const hasExtractedText = docColumns.some((col) => col.name === "extractedText");
  if (!hasExtractedText) {
    await database.execAsync(
      "ALTER TABLE documents ADD COLUMN extractedText TEXT NOT NULL DEFAULT ''"
    );
  }

  // Migration: add analysis (JSON) column to documents if missing.
  const hasAnalysis = docColumns.some((col) => col.name === "analysis");
  if (!hasAnalysis) {
    await database.execAsync("ALTER TABLE documents ADD COLUMN analysis TEXT");
  }

  // Migration: add reminder columns to medications if missing.
  const medColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(medications)"
  );
  if (!medColumns.some((col) => col.name === "reminderEnabled")) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN reminderEnabled INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!medColumns.some((col) => col.name === "reminderTimes")) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN reminderTimes TEXT NOT NULL DEFAULT '[]'"
    );
  }
  if (!medColumns.some((col) => col.name === "reminderNotificationIds")) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN reminderNotificationIds TEXT NOT NULL DEFAULT '[]'"
    );
  }

  // Migration: add ownerId to existing databases that lack it.
  const columns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(medications)"
  );
  const hasOwnerId = columns.some((col) => col.name === "ownerId");
  if (!hasOwnerId) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN ownerId TEXT NOT NULL DEFAULT ''"
    );
  }

  // Migration: rebuild medications with patientId FK if missing.
  const hasPatientId = columns.some((col) => col.name === "patientId");
  const fkList = await database.getAllAsync<{ from: string; table: string }>(
    "PRAGMA foreign_key_list(medications)"
  );
  const hasPatientIdFK = fkList.some(
    (fk) => fk.from === "patientId" && fk.table === "patients"
  );

  if (!hasPatientIdFK) {
    await database.execAsync("BEGIN TRANSACTION");
    try {
      const cols = hasPatientId
        ? "id, ownerId, patientId, name, dosage, frequency, reminderEnabled, reminderTimes, reminderNotificationIds, dateAdded"
        : "id, ownerId, name, dosage, frequency, reminderEnabled, reminderTimes, reminderNotificationIds, dateAdded";
      await database.execAsync(`
        CREATE TABLE _scans_backup AS
          SELECT * FROM scans;
        CREATE TABLE medications_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ownerId TEXT NOT NULL,
          patientId INTEGER,
          name TEXT NOT NULL,
          dosage TEXT NOT NULL,
          frequency TEXT NOT NULL,
          reminderEnabled INTEGER NOT NULL DEFAULT 0,
          reminderTimes TEXT NOT NULL DEFAULT '[]',
          reminderNotificationIds TEXT NOT NULL DEFAULT '[]',
          dateAdded TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL
        );
        INSERT INTO medications_new (${cols})
          SELECT ${cols} FROM medications;
        DROP TABLE medications;
        ALTER TABLE medications_new RENAME TO medications;
        DELETE FROM scans;
        INSERT INTO scans
          SELECT s.* FROM _scans_backup s
            JOIN medications m ON s.medicationId = m.id;
        DROP TABLE _scans_backup;
      `);
      await database.execAsync("COMMIT");
    } catch (err) {
      await database.execAsync("ROLLBACK");
      throw err;
    }
  }
}

// --- Patients CRUD ---

export async function addPatient(
  patient: Omit<Patient, "id" | "dateAdded">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "INSERT INTO patients (ownerId, name) VALUES (?, ?)",
    [ownerId, patient.name]
  );
  return result.lastInsertRowId;
}

export async function getAllPatients(ownerId: string): Promise<Patient[]> {
  const database = getDatabase();
  return database.getAllAsync<Patient>(
    "SELECT * FROM patients WHERE ownerId = ? ORDER BY dateAdded DESC",
    [ownerId]
  );
}

export async function getPatientById(
  id: number,
  ownerId: string
): Promise<Patient | null> {
  const database = getDatabase();
  return database.getFirstAsync<Patient>(
    "SELECT * FROM patients WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}

export async function updatePatient(
  id: number,
  ownerId: string,
  name: string
): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    "UPDATE patients SET name = ? WHERE id = ? AND ownerId = ?",
    [name, id, ownerId]
  );
}

export async function deletePatient(id: number, ownerId: string): Promise<void> {
  const database = getDatabase();

  const docs = await database.getAllAsync<Document>(
    "SELECT imageUri FROM documents WHERE patientId = ? AND ownerId = ?",
    [id, ownerId]
  );

  await database.runAsync(
    "DELETE FROM patients WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );

  for (const doc of docs) {
    try {
      const file = new File(doc.imageUri);
      if (file.exists) file.delete();
    } catch {}
  }
}

// --- Medications CRUD ---

export async function addMedication(
  medication: Omit<Medication, "id" | "dateAdded" | "ownerId">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  if (medication.patientId != null) {
    const patient = await database.getFirstAsync<Patient>(
      "SELECT id FROM patients WHERE id = ? AND ownerId = ?",
      [medication.patientId, ownerId]
    );
    if (!patient) {
      throw new Error("Patient not found or access denied.");
    }
  }
  const result = await database.runAsync(
    "INSERT INTO medications (ownerId, patientId, name, dosage, frequency, reminderEnabled, reminderTimes, reminderNotificationIds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      ownerId,
      medication.patientId ?? null,
      medication.name,
      medication.dosage,
      medication.frequency,
      medication.reminderEnabled ? 1 : 0,
      medication.reminderTimes,
      medication.reminderNotificationIds,
    ]
  );
  return result.lastInsertRowId;
}

export async function getAllMedications(ownerId: string): Promise<Medication[]> {
  const database = getDatabase();
  return database.getAllAsync<Medication>(
    "SELECT * FROM medications WHERE ownerId = ? ORDER BY dateAdded DESC",
    [ownerId]
  );
}

export async function getMedicationsByPatient(
  patientId: number,
  ownerId: string
): Promise<Medication[]> {
  const database = getDatabase();
  return database.getAllAsync<Medication>(
    "SELECT * FROM medications WHERE ownerId = ? AND patientId = ? ORDER BY dateAdded DESC",
    [ownerId, patientId]
  );
}

export async function getMedicationById(
  id: number,
  ownerId: string
): Promise<Medication | null> {
  const database = getDatabase();
  return database.getFirstAsync<Medication>(
    "SELECT * FROM medications WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}

export async function deleteMedication(id: number, ownerId: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    "DELETE FROM medications WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}

export async function updateMedicationReminder(
  id: number,
  ownerId: string,
  reminderEnabled: boolean,
  reminderTimesJson: string
): Promise<void> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE medications SET reminderEnabled = ?, reminderTimes = ? WHERE id = ? AND ownerId = ?",
    [reminderEnabled ? 1 : 0, reminderTimesJson, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Medication not found or access denied.");
  }
}

export async function setMedicationReminderNotificationIds(
  id: number,
  ownerId: string,
  notificationIdsJson: string
): Promise<void> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE medications SET reminderNotificationIds = ? WHERE id = ? AND ownerId = ?",
    [notificationIdsJson, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Medication not found or access denied.");
  }
}

// --- Scans (scoped through medication owner) ---

export async function addScan(
  scan: Omit<ScanRecord, "id" | "timestamp">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  // Verify the medication belongs to this owner before inserting
  const medication = await database.getFirstAsync<Medication>(
    "SELECT id FROM medications WHERE id = ? AND ownerId = ?",
    [scan.medicationId, ownerId]
  );
  if (!medication) {
    throw new Error("Medication not found or access denied.");
  }
  const result = await database.runAsync(
    "INSERT INTO scans (medicationId, rawBarcodeData) VALUES (?, ?)",
    [scan.medicationId, scan.rawBarcodeData]
  );
  return result.lastInsertRowId;
}

export async function getScansForMedication(
  medicationId: number,
  ownerId: string
): Promise<ScanRecord[]> {
  const database = getDatabase();
  return database.getAllAsync<ScanRecord>(
    `SELECT s.* FROM scans s
     JOIN medications m ON s.medicationId = m.id
     WHERE s.medicationId = ? AND m.ownerId = ?`,
    [medicationId, ownerId]
  );
}

export async function getScansByPatient(
  patientId: number,
  ownerId: string
): Promise<ScanRecord[]> {
  const database = getDatabase();
  return database.getAllAsync<ScanRecord>(
    `SELECT s.* FROM scans s
     JOIN medications m ON s.medicationId = m.id
     WHERE m.patientId = ? AND m.ownerId = ?`,
    [patientId, ownerId]
  );
}

// --- Legacy migration (unclaimed records) ---

export async function getUnclaimedMedications(): Promise<Medication[]> {
  const database = getDatabase();
  return database.getAllAsync<Medication>(
    "SELECT * FROM medications WHERE ownerId = '' ORDER BY dateAdded DESC"
  );
}

export async function claimMedications(ownerId: string): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE medications SET ownerId = ? WHERE ownerId = ''",
    [ownerId]
  );
  return result.changes;
}

// --- Documents CRUD ---

export async function addDocument(
  doc: Omit<Document, "id" | "dateAdded" | "analysis">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  const patient = await database.getFirstAsync<Patient>(
    "SELECT id FROM patients WHERE id = ? AND ownerId = ?",
    [doc.patientId, ownerId]
  );
  if (!patient) {
    throw new Error("Patient not found or access denied.");
  }
  const result = await database.runAsync(
    "INSERT INTO documents (ownerId, patientId, imageUri, title, extractedText) VALUES (?, ?, ?, ?, ?)",
    [ownerId, doc.patientId, doc.imageUri, doc.title, doc.extractedText ?? ""]
  );
  return result.lastInsertRowId;
}

export async function getDocumentsByPatient(
  patientId: number,
  ownerId: string
): Promise<Document[]> {
  const database = getDatabase();
  return database.getAllAsync<Document>(
    "SELECT * FROM documents WHERE patientId = ? AND ownerId = ? ORDER BY dateAdded DESC",
    [patientId, ownerId]
  );
}

export async function getDocumentById(
  id: number,
  ownerId: string
): Promise<Document | null> {
  const database = getDatabase();
  return database.getFirstAsync<Document>(
    "SELECT * FROM documents WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}

export async function updateDocumentText(
  id: number,
  ownerId: string,
  extractedText: string
): Promise<void> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE documents SET extractedText = ? WHERE id = ? AND ownerId = ?",
    [extractedText, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Document not found or access denied.");
  }
}

export async function updateDocumentAnalysis(
  id: number,
  ownerId: string,
  analysisJson: string | null
): Promise<void> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE documents SET analysis = ? WHERE id = ? AND ownerId = ?",
    [analysisJson, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Document not found or access denied.");
  }
}

export async function deleteDocument(id: number, ownerId: string): Promise<void> {
  const database = getDatabase();

  const doc = await database.getFirstAsync<Document>(
    "SELECT imageUri FROM documents WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );

  await database.runAsync(
    "DELETE FROM documents WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );

  if (doc) {
    try {
      const file = new File(doc.imageUri);
      if (file.exists) file.delete();
    } catch {}
  }
}

export async function deleteDocuments(ids: number[], ownerId: string): Promise<void> {
  if (ids.length === 0) return;
  const database = getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  const docs = await database.getAllAsync<Document>(
    `SELECT imageUri FROM documents WHERE id IN (${placeholders}) AND ownerId = ?`,
    [...ids, ownerId]
  );

  await database.runAsync(
    `DELETE FROM documents WHERE id IN (${placeholders}) AND ownerId = ?`,
    [...ids, ownerId]
  );

  for (const doc of docs) {
    try {
      const file = new File(doc.imageUri);
      if (file.exists) file.delete();
    } catch {}
  }
}

export async function updateDocumentTitle(
  id: number,
  ownerId: string,
  title: string
): Promise<void> {
  const database = getDatabase();
  const result = await database.runAsync(
    "UPDATE documents SET title = ? WHERE id = ? AND ownerId = ?",
    [title, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Document not found or access denied.");
  }
}

export async function moveDocument(
  id: number,
  ownerId: string,
  newPatientId: number
): Promise<void> {
  const database = getDatabase();
  const patient = await database.getFirstAsync<Patient>(
    "SELECT id FROM patients WHERE id = ? AND ownerId = ?",
    [newPatientId, ownerId]
  );
  if (!patient) {
    throw new Error("Target patient not found or access denied.");
  }
  const result = await database.runAsync(
    "UPDATE documents SET patientId = ? WHERE id = ? AND ownerId = ?",
    [newPatientId, id, ownerId]
  );
  if (result.changes === 0) {
    throw new Error("Document not found or access denied.");
  }
}

export async function copyDocument(
  id: number,
  ownerId: string,
  newPatientId: number
): Promise<number> {
  const database = getDatabase();
  const patient = await database.getFirstAsync<Patient>(
    "SELECT id FROM patients WHERE id = ? AND ownerId = ?",
    [newPatientId, ownerId]
  );
  if (!patient) {
    throw new Error("Target patient not found or access denied.");
  }
  const doc = await database.getFirstAsync<Document>(
    "SELECT * FROM documents WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
  if (!doc) {
    throw new Error("Document not found or access denied.");
  }

  const docsDir = new Directory(Paths.document, "documents");
  if (!docsDir.exists) {
    docsDir.create();
  }
  const filename = `doc_${newPatientId}_${Date.now()}.jpg`;
  const destFile = new File(docsDir, filename);
  const srcFile = new File(doc.imageUri);
  srcFile.copy(destFile);

  const result = await database.runAsync(
    "INSERT INTO documents (ownerId, patientId, imageUri, title, extractedText, analysis) VALUES (?, ?, ?, ?, ?, ?)",
    [ownerId, newPatientId, destFile.uri, doc.title, doc.extractedText ?? "", doc.analysis]
  );
  return result.lastInsertRowId;
}

export async function getAllDocuments(ownerId: string): Promise<Document[]> {
  const database = getDatabase();
  return database.getAllAsync<Document>(
    "SELECT * FROM documents WHERE ownerId = ? ORDER BY dateAdded DESC",
    [ownerId]
  );
}
