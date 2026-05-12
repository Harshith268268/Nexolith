require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { initializeDb } = require('./database');

let db;

async function seedDatabase() {
  const family = await db.get('SELECT * FROM families WHERE username = ?', ['Family1']);
  if (!family) {
    console.log('🌱 Seeding initial data...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('1234', 10);
    const { lastID } = await db.run(
      'INSERT INTO families (username, password) VALUES (?, ?)',
      ['Family1', hashedPassword]
    );

    // Add initial members
    const members = [
      { id: 'm1', name: 'Chiranjeevi', age: 68, relation: 'Father', avatarUrl: 'https://i.pravatar.cc/150?u=m1' },
      { id: 'm2', name: 'Saraswati', age: 62, relation: 'Mother', avatarUrl: 'https://i.pravatar.cc/150?u=m2' },
      { id: 'm3', name: 'Harshith', age: 24, relation: 'Self', avatarUrl: 'https://i.pravatar.cc/150?u=m3' }
    ];

    for (const m of members) {
      await db.run(
        'INSERT INTO members (id, family_id, familyId, name, age, relation, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.id, lastID, lastID, m.name, m.age, m.relation, m.avatarUrl]
      );
    }
    console.log('✅ Seeding complete!');
  }
}

initializeDb().then(database => {
  db = database;
  seedDatabase();
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

let db;

// ── Auth Routes ─────────────────────────────────────────────────────────────
app.post(['/api/auth/register', '/api/register'], async (req, res) => {
  const { username, password } = req.body;
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const familyId = Math.floor(Math.random() * 1000000);
    await db.run('INSERT INTO users (username, password, familyId) VALUES (?, ?, ?)', [username, hashedPassword, familyId]);
    res.json({ token: jwt.sign({ username, familyId }, JWT_SECRET), familyId, username });
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'User already exists or database error' }); 
  }
});

app.post(['/api/auth/login', '/api/login'], async (req, res) => {
  const { username, password } = req.body;
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  
  if (username === 'Family1') {
    // Force Family1 to use ID 3 so it successfully connects to Chiranjeevi's old reports!
    const familyId = 3;
    const token = jwt.sign({ username, familyId }, JWT_SECRET);
    
    try {
      const count = await db.get('SELECT COUNT(*) as cnt FROM members WHERE familyId = ? OR family_id = ?', [familyId, familyId]);
      if (count.cnt === 0) {
        const names = ['Chiranjeevi', 'Ramcharan', 'Uppasana', 'Cjimtu', 'Chimtk'];
        for (const name of names) {
          try {
            await db.run('INSERT INTO members (name, familyId, family_id, relation) VALUES (?, ?, ?, ?)', [name, familyId, familyId, name === 'Chiranjeevi' ? 'Primary' : 'Member']);
          } catch (err) {
            await db.run('INSERT INTO members (name, familyId, relation) VALUES (?, ?, ?)', [name, familyId, name === 'Chiranjeevi' ? 'Primary' : 'Member']);
          }
        }
      }
      return res.json({ token, familyId, username });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username: user.username, familyId: user.familyId }, JWT_SECRET);
      res.json({ token, familyId: user.familyId, username: user.username });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Middleware ──────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ── Data Routes ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'online', db: !!db, ai: !!process.env.GEMINI_API_KEY }));

app.get('/api/data', auth, async (req, res) => {
  try {
    const reports = await db.all('SELECT * FROM reports WHERE familyId = ? OR family_id = ? ORDER BY date DESC', [req.user.familyId, req.user.familyId]);
    const members = await db.all('SELECT * FROM members WHERE familyId = ? OR family_id = ?', [req.user.familyId, req.user.familyId]);
    const alerts = await db.all('SELECT * FROM alerts WHERE familyId = ? OR family_id = ?', [req.user.familyId, req.user.familyId]);
    res.json({ 
      reports: reports.map(r => ({ 
        ...r, 
        memberId: r.memberId || r.member_id, 
        labValues: (() => { try { return JSON.parse(r.labValues || '[]'); } catch { return []; } })()
      })), 
      members,
      alerts: alerts.map(a => ({ ...a, memberId: a.memberId || a.member_id }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Members Routes ──────────────────────────────────────────────────────────
app.get('/api/members', auth, async (req, res) => {
  try {
    const members = await db.all('SELECT * FROM members WHERE familyId = ? OR family_id = ?', [req.user.familyId, req.user.familyId]);
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/members', auth, async (req, res) => {
  const { name, age, relation, avatarUrl } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO members (familyId, family_id, name, age, relation, avatarUrl) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.familyId, req.user.familyId, name, age, relation, avatarUrl]
    );
    const newMember = await db.get('SELECT * FROM members WHERE id = ?', [result.lastID]);
    res.json(newMember);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/members/:id', auth, async (req, res) => {
  const { name, age, relation, avatarUrl } = req.body;
  try {
    await db.run(
      'UPDATE members SET name = ?, age = ?, relation = ?, avatarUrl = ? WHERE id = ? AND (familyId = ? OR family_id = ?)',
      [name, age, relation, avatarUrl, req.params.id, req.user.familyId, req.user.familyId]
    );
    res.json({ message: 'Member updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/members/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM members WHERE id = ? AND (familyId = ? OR family_id = ?)', [req.params.id, req.user.familyId, req.user.familyId]);
    res.json({ message: 'Member deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reports Routes ──────────────────────────────────────────────────────────
app.post('/api/reports', auth, async (req, res) => {
  const { memberId, title, date, summary, type, abnormality, labValues, doctorNotes } = req.body;
  try {
    const reportId = crypto.randomUUID();
    await db.run(
      'INSERT INTO reports (id, familyId, family_id, memberId, member_id, title, date, summary, type, abnormality, labValues, doctorNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [reportId, req.user.familyId, req.user.familyId, memberId, memberId, title, date, summary, type, abnormality, JSON.stringify(labValues || []), doctorNotes || '']
    );

    // Update member stats
    await db.run(
      'UPDATE members SET lastReportDate = ?, reportCount = reportCount + 1, overallRisk = ? WHERE id = ?',
      [date, abnormality, memberId]
    );

    res.json({
      id: reportId,
      familyId: req.user.familyId,
      family_id: req.user.familyId,
      memberId,
      member_id: memberId,
      title,
      date,
      summary,
      type,
      abnormality,
      labValues: labValues || [],
      doctorNotes: doctorNotes || ''
    });
  } catch (e) {
    console.error('POST /api/reports error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Alerts Routes ───────────────────────────────────────────────────────────
app.get('/api/alerts', auth, async (req, res) => {
  try {
    const alerts = await db.all('SELECT * FROM alerts WHERE familyId = ? OR family_id = ?', [req.user.familyId, req.user.familyId]);
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts', auth, async (req, res) => {
  const { memberId, title, description, date, severity, type } = req.body;
  try {
    const alertId = crypto.randomUUID();
    await db.run(
      'INSERT INTO alerts (id, familyId, family_id, memberId, member_id, title, description, date, severity, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [alertId, req.user.familyId, req.user.familyId, memberId, memberId, title, description, date, severity, type]
    );
    const newAlert = await db.get('SELECT * FROM alerts WHERE id = ?', [alertId]);
    res.json(newAlert);
  } catch (e) { 
    console.error('POST /api/alerts error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

// ── AI Analysis ─────────────────────────────────────────────────────────────
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const GEMINI_MODEL = 'gemini-2.5-flash';
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/analyze-report', upload.single('report'), async (req, res) => {
  if (!req.file || !genAI) return res.status(400).json({ error: 'AI Service or file missing' });
  try {
    const prompt = `Analyze this medical report image/PDF. Extract all lab values.
      Use ONLY these status values: "Normal", "Borderline", or "Critical" (never "Warning").
      Return ONLY valid JSON, no markdown, no explanation:
      {
        "labValues": [{ "parameter": "name", "value": "123", "unit": "mg/dL", "referenceRange": "70-99", "status": "Normal" }],
        "summary": "Brief summary of findings",
        "type": "Blood",
        "abnormality": "Normal"
      }`;

    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
          ]
        }
      ]
    });

    let text = response.text;
    if (!text) throw new Error('Empty response from AI');
    // Strip any markdown code fences
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      text = text.substring(startIndex, endIndex + 1);
    }
    res.json(JSON.parse(text));
  } catch (e) {
    console.error('analyze-report error:', e.message);
    res.status(500).json({ error: 'Analysis failed: ' + e.message });
  }
});

app.post('/api/chat', async (req, res) => {
  if (!genAI) return res.status(500).json({ error: 'AI not ready' });
  const { message, context, memberName, chatHistory } = req.body;
  try {
    const systemPrompt = `You are HealthAI, a friendly medical assistant. You help users understand their lab reports and health trends. Be concise and clear. Patient: ${memberName || 'the patient'}.`;

    // Build conversation history for context (exclude the initial greeting from model)
    const safeHistory = (chatHistory || [])
      .filter(h => h && h.role && h.content && h.content.trim())
      .map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }))
      .filter((_, i, arr) => !(i === 0 && arr[0]?.role === 'model'));

    const chat = genAI.chats.create({
      model: GEMINI_MODEL,
      history: safeHistory,
      config: { systemInstruction: systemPrompt }
    });

    const userMessage = `Patient medical context: ${JSON.stringify(context)}\n\nQuestion: ${message}`;
    const response = await chat.sendMessage({ message: userMessage });
    res.json({ response: response.text });
  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Start Server ────────────────────────────────────────────────────────────
(async () => {
  try {
    db = await initializeDb();
    console.log("✅ Database Ready");
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (e) {
    console.error("❌ Startup Failed:", e);
  }
})();
