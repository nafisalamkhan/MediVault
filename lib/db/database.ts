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

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
}

// --- Medications CRUD ---

export async function addMedication(
  medication: Omit<Medication, "id" | "dateAdded">
): Promise<number> {
  const database = getDatabase();
  const result = await database.runAsync(
    "INSERT INTO medications (name, dosage, frequency) VALUES (?, ?, ?)",
    [medication.name, medication.dosage, medication.frequency]
  );
  return result.lastInsertRowId;
}

export async function getAllMedications(): Promise<Medication[]> {
  const database = getDatabase();
  return database.getAllAsync<Medication>(
    "SELECT * FROM medications ORDER BY dateAdded DESC"
  );
}

export async function getMedicationById(
  id: number
): Promise<Medication | null> {
  const database = getDatabase();
  return database.getFirstAsync<Medication>(
    "SELECT * FROM medications WHERE id = ?",
    [id]
  );
}

export async function deleteMedication(id: number): Promise<void> {
  const database = getDatabase();
  await database.runAsync("DELETE FROM medications WHERE id = ?", [id]);
}
