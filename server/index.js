const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initializeDb } = require('./database');

dotenv.config();

let db;

async function seedDatabase() {
  try {
    const importPath = path.join(__dirname, 'cloud_import.json');
    if (fs.existsSync(importPath)) {
      console.log('🔄 FOUND EXACT LOCAL DATA! Starting Full Cloud Sync...');
      const rawData = fs.readFileSync(importPath);
      const data = JSON.parse(rawData);

      // Total Wipe for Clean Import
      await db.run('DELETE FROM alerts');
      await db.run('DELETE FROM reports');
      await db.run('DELETE FROM members');
      await db.run('DELETE FROM families');

      // Import Families
      for (const f of data.families) {
        await db.run(
          'INSERT OR REPLACE INTO families (id, username, password) VALUES (?, ?, ?)',
          [f.id, f.username, f.password]
        );
      }

      // IMPORT ALL MEMBERS TO FAMILY ID 3 (The main user)
      const targetFamilyId = 3; 
      for (const m of data.members) {
        await db.run(
          'INSERT OR REPLACE INTO members (id, family_id, familyId, name, age, relation, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [m.id, targetFamilyId, targetFamilyId, m.name, m.age, m.relation, m.avatarUrl]
        );
      }

      // IMPORT ALL REPORTS TO FAMILY ID 3
      for (const r of data.reports) {
        await db.run(
          'INSERT OR REPLACE INTO reports (id, family_id, familyId, member_id, memberId, title, date, type, abnormality, summary, doctorNotes, labValues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [r.id, targetFamilyId, targetFamilyId, r.member_id, r.memberId || r.member_id, r.title, r.date, r.type, r.abnormality, r.summary, r.doctorNotes || '', r.labValues || '[]']
        );
      }
      
      console.log('✅ TOTAL SYNC SUCCESSFUL! Everything is now tied to Family ID 3.');
      fs.renameSync(importPath, importPath + '.done');
    }
  } catch (err) {
    console.error('❌ Sync Error:', err);
  }
}

initializeDb().then(database => {
  db = database;
  seedDatabase();
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Auth Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const family = await db.get('SELECT * FROM families WHERE LOWER(username) = LOWER(?)', [username]);
    if (!family) return res.status(401).json({ error: 'Invalid credentials' });
    const isValid = await bcrypt.compare(password, family.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: family.id, username: family.username }, process.env.JWT_SECRET || 'secret');
    res.json({ token, family: { id: family.id, username: family.username } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const members = await db.all('SELECT * FROM members WHERE family_id = ?', [decoded.id]);
    const reports = await db.all('SELECT * FROM reports WHERE family_id = ?', [decoded.id]);
    const alerts = await db.all('SELECT * FROM alerts WHERE family_id = ?', [decoded.id]);
    res.json({ members, reports, alerts });
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
});

app.post('/api/reports', async (req, res) => {
  const { id, memberId, familyId, title, date, type, abnormality, summary, doctorNotes, labValues } = req.body;
  const fId = familyId || req.body.family_id;
  const mId = memberId || req.body.member_id;
  try {
    await db.run(
      'INSERT INTO reports (id, family_id, familyId, member_id, memberId, title, date, type, abnormality, summary, doctorNotes, labValues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id || crypto.randomUUID(), fId, fId, mId, mId, title, date, type, abnormality, summary, doctorNotes, JSON.stringify(labValues)]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function analyzeReportHandler(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const result = await model.generateContent([
      "Analyze this medical report. Return ONLY JSON with summary, type, abnormality, and labValues.",
      { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
    ]);
    res.json(JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

app.post('/api/analyze-report', upload.single('report'), analyzeReportHandler);
app.post('/api/analyze_report', upload.single('report'), analyzeReportHandler);

app.get('/api/debug/db', async (req, res) => {
  try {
    const families = await db.all('SELECT id, username FROM families');
    const counts = {
      families: families.length,
      members: (await db.get('SELECT COUNT(*) as count FROM members')).count,
      reports: (await db.get('SELECT COUNT(*) as count FROM reports')).count
    };
    res.json({ status: 'Online', families, counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(port, '0.0.0.0', () => console.log(`Server on ${port}`));
