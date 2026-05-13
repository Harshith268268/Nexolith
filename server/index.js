const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initializeDb } = require('./database');

dotenv.config();

let db;

async function seedDatabase() {
  try {
    console.log('🔍 Checking database content...');
    let family = await db.get('SELECT * FROM families WHERE username = ?', ['Family1']);
    
    if (!family) {
      console.log('🌱 Seeding initial family account...');
      const hashedPassword = await bcrypt.hash('1234', 10);
      await db.run(
        'INSERT INTO families (username, password) VALUES (?, ?)',
        ['Family1', hashedPassword]
      );
      family = await db.get('SELECT * FROM families WHERE username = ?', ['Family1']);
    }

    const family_id = family.id;
    console.log('👥 Syncing family members...');
    const members = [
      { id: 'm1', name: 'Chiranjeevi', age: 68, relation: 'Father', avatarUrl: 'https://i.pravatar.cc/150?u=m1' },
      { id: 'm2', name: 'Ramcharan', age: 39, relation: 'Son', avatarUrl: 'https://i.pravatar.cc/150?u=m2' },
      { id: 'm3', name: 'Upasana', age: 35, relation: 'Daughter-in-law', avatarUrl: 'https://i.pravatar.cc/150?u=m3' }
    ];

    // Clear old members and reports to ensure a clean sync
    await db.run('DELETE FROM reports WHERE family_id = ?', [family_id]);
    await db.run('DELETE FROM members WHERE family_id = ?', [family_id]);

    for (const m of members) {
      await db.run(
        'INSERT INTO members (id, family_id, familyId, name, age, relation, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.id, family_id, family_id, m.name, m.age, m.relation, m.avatarUrl]
      );
    }

    console.log('📄 Syncing initial reports...');
    const reports = [
      { id: 'r1', member_id: 'm1', title: 'Cardiology Report', date: '2024-05-10', type: 'Cardiology', abnormality: 'Borderline', summary: 'Mild heart rate elevation noted.' },
      { id: 'r2', member_id: 'm2', title: 'Fitness Assessment', date: '2024-04-15', type: 'General', abnormality: 'Normal', summary: 'Excellent cardiovascular health.' },
      { id: 'r3', member_id: 'm3', title: 'Blood Wellness', date: '2024-03-20', type: 'Blood', abnormality: 'Normal', summary: 'All parameters within optimal range.' }
    ];

    for (const r of reports) {
      await db.run(
        'INSERT INTO reports (id, family_id, familyId, member_id, memberId, title, date, type, abnormality, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, family_id, family_id, r.member_id, r.member_id, r.title, r.date, r.type, r.abnormality, r.summary]
      );
    }
    console.log('✅ Cloud Data Sync Complete!');
  } catch (err) {
    console.error('❌ Seeding Error:', err);
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
    const family = await db.get('SELECT * FROM families WHERE username = ?', [username]);
    if (!family || !(await bcrypt.compare(password, family.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: family.id, username: family.username }, process.env.JWT_SECRET || 'secret');
    res.json({ token, family: { id: family.id, username: family.username } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Data Routes
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

app.post('/api/alerts', async (req, res) => {
  const { id, memberId, familyId, title, description, date, severity, type, status } = req.body;
  const fId = familyId || req.body.family_id;
  const mId = memberId || req.body.member_id;
  try {
    await db.run(
      'INSERT INTO alerts (id, family_id, familyId, member_id, memberId, title, description, date, severity, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id || crypto.randomUUID(), fId, fId, mId, mId, title, description, date, severity, type, status || 'Active']
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI Route
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

app.listen(port, '0.0.0.0', () => console.log(`Server on ${port}`));
