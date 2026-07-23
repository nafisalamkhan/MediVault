import * as SQLite from "expo-sqlite";
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
      dateAdded TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

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

  // Migration: add patientId to existing databases that lack it.
  const hasPatientId = columns.some((col) => col.name === "patientId");
  if (!hasPatientId) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN patientId INTEGER"
    );
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
  await database.runAsync(
    "DELETE FROM patients WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}

// --- Medications CRUD ---

export async function addMedication(
  medication: Omit<Medication, "id" | "dateAdded" | "ownerId">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "INSERT INTO medications (ownerId, patientId, name, dosage, frequency) VALUES (?, ?, ?, ?, ?)",
    [ownerId, medication.patientId ?? null, medication.name, medication.dosage, medication.frequency]
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
  doc: Omit<Document, "id" | "dateAdded">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "INSERT INTO documents (ownerId, patientId, imageUri, title) VALUES (?, ?, ?, ?)",
    [ownerId, doc.patientId, doc.imageUri, doc.title]
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

export async function deleteDocument(id: number, ownerId: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    "DELETE FROM documents WHERE id = ? AND ownerId = ?",
    [id, ownerId]
  );
}
