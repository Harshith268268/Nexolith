const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

async function initializeDb() {
  const dbPath = path.join(__dirname, 'database_v2.sqlite');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.get('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      familyId INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      familyId INTEGER NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      relation TEXT,
      avatarUrl TEXT,
      lastReportDate TEXT,
      reportCount INTEGER DEFAULT 0,
      overallRisk TEXT DEFAULT 'Normal'
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      familyId INTEGER NOT NULL,
      memberId INTEGER NOT NULL,
      title TEXT,
      date TEXT,
      type TEXT,
      abnormality TEXT DEFAULT 'Normal',
      summary TEXT,
      doctorNotes TEXT,
      labValues TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      familyId INTEGER NOT NULL,
      memberId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      severity TEXT DEFAULT 'Normal',
      type TEXT DEFAULT 'Reminder',
      status TEXT DEFAULT 'Active',
      read INTEGER DEFAULT 0
    );
  `);

  // Migration: Add columns if they are missing from older versions
  const tables = ['members', 'reports', 'alerts'];
  for (const table of tables) {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN familyId INTEGER`);
    } catch (e) {
      // Column already exists
    }
  }

  return db;
}

module.exports = { initializeDb };
