const { Pool } = require('pg');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

async function initializeDb() {
  const isPostgres = !!process.env.DATABASE_URL;

  if (isPostgres) {
    console.log('🐘 Using PostgreSQL Database');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Create tables in PostgreSQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS families (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id),
        name TEXT NOT NULL,
        age INTEGER,
        relation TEXT,
        avatarUrl TEXT,
        lastReportDate TEXT,
        reportCount INTEGER DEFAULT 0,
        overallRisk TEXT DEFAULT 'Normal',
        familyId INTEGER
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id),
        member_id TEXT NOT NULL REFERENCES members(id),
        title TEXT,
        date TEXT,
        type TEXT,
        abnormality TEXT DEFAULT 'Normal',
        summary TEXT,
        doctorNotes TEXT,
        labValues TEXT DEFAULT '[]',
        familyId INTEGER,
        memberId TEXT
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id),
        member_id TEXT NOT NULL REFERENCES members(id),
        title TEXT NOT NULL,
        description TEXT,
        date TEXT,
        severity TEXT DEFAULT 'Normal',
        type TEXT DEFAULT 'Reminder',
        status TEXT DEFAULT 'Active',
        read INTEGER DEFAULT 0,
        familyId INTEGER,
        memberId TEXT
      );
    `);

    // Wrap pool to behave like sqlite object for basic queries if possible
    // or just return the pool and handle it in index.js
    return {
      type: 'postgres',
      pool,
      get: async (sql, params) => {
        const res = await pool.query(sql.replace(/\?/g, (val, i) => `$${i + 1}`), params);
        return res.rows[0];
      },
      all: async (sql, params) => {
        const res = await pool.query(sql.replace(/\?/g, (val, i) => `$${i + 1}`), params);
        return res.rows;
      },
      run: async (sql, params) => {
        return await pool.query(sql.replace(/\?/g, (val, i) => `$${i + 1}`), params);
      }
    };
  } else {
    // Fallback to SQLite for local development
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    
    console.log(`📂 Using SQLite Database at: ${dbPath}`);
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.get('PRAGMA foreign_keys = ON');

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
    
    return { type: 'sqlite', db, get: db.get.bind(db), all: db.all.bind(db), run: db.run.bind(db) };
  }
}

module.exports = { initializeDb };
