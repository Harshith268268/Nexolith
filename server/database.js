const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

async function initializeDb() {
  // Use /data/database.sqlite on Railway (persistent volume mounted at /data)
  // Fall back to local __dirname for development
  const dbPath = process.env.RAILWAY_ENVIRONMENT
    ? '/data/database.sqlite'
    : path.join(__dirname, 'database.sqlite');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

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
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  return db;
}

module.exports = { initializeDb };
