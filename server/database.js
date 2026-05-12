const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

async function initializeDb() {
  // Use DB_PATH from environment (for Railway Volumes) or default to local file
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
  
  // Ensure the directory exists (required for Railway volumes)
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    console.log(`📁 Creating directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`📂 Using database at: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.get('PRAGMA foreign_keys = ON');

  // Create tables using the correct schema
  await db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      relation TEXT,
      avatarUrl TEXT,
      lastReportDate TEXT,
      reportCount INTEGER DEFAULT 0,
      overallRisk TEXT DEFAULT 'Normal',
      familyId INTEGER,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      family_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      title TEXT,
      date TEXT,
      type TEXT,
      abnormality TEXT DEFAULT 'Normal',
      summary TEXT,
      doctorNotes TEXT,
      labValues TEXT DEFAULT '[]',
      familyId INTEGER,
      memberId TEXT,
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      family_id INTEGER NOT NULL,
      member_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      severity TEXT DEFAULT 'Normal',
      type TEXT DEFAULT 'Reminder',
      status TEXT DEFAULT 'Active',
      read INTEGER DEFAULT 0,
      familyId INTEGER,
      memberId TEXT,
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  // Migration: Add columns if they are missing from older versions
  const tables = ['members', 'reports', 'alerts'];
  for (const table of tables) {
    try { await db.exec(`ALTER TABLE ${table} ADD COLUMN familyId INTEGER`); } catch (e) {}
    try { await db.exec(`ALTER TABLE ${table} ADD COLUMN memberId TEXT`); } catch (e) {}
  }

  return db;
}

module.exports = { initializeDb };
