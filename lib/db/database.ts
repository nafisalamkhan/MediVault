import * as SQLite from "expo-sqlite";
import type { Medication, ScanRecord } from "./schema";

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
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      dateAdded TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicationId INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      rawBarcodeData TEXT NOT NULL,
      FOREIGN KEY (medicationId) REFERENCES medications(id) ON DELETE CASCADE
    );
  `);

  // Migration: add ownerId to existing databases that lack it.
  // Legacy rows get ownerId = '' (unclaimed). Use getUnclaimedMedications()
  // and claimMedications(ownerId) to explicitly migrate them.
  const columns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(medications)"
  );
  const hasOwnerId = columns.some((col) => col.name === "ownerId");
  if (!hasOwnerId) {
    await database.execAsync(
      "ALTER TABLE medications ADD COLUMN ownerId TEXT NOT NULL DEFAULT ''"
    );
  }
}

// --- Medications CRUD ---

export async function addMedication(
  medication: Omit<Medication, "id" | "dateAdded" | "ownerId">,
  ownerId: string
): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "INSERT INTO medications (ownerId, name, dosage, frequency) VALUES (?, ?, ?, ?)",
    [ownerId, medication.name, medication.dosage, medication.frequency]
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
