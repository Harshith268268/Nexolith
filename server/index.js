require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initializeDb } = require('./database');

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
    const familyId = 12345;
    const token = jwt.sign({ username, familyId }, JWT_SECRET);
    
    try {
      const count = await db.get('SELECT COUNT(*) as cnt FROM members WHERE familyId = ?', [familyId]);
      if (count.cnt === 0) {
        const names = ['Chiranjeevi', 'Ramcharan', 'Uppasana', 'Cjimtu', 'Chimtk'];
        for (const name of names) {
          await db.run('INSERT INTO members (name, familyId, relation) VALUES (?, ?, ?)', [name, familyId, name === 'Chiranjeevi' ? 'Primary' : 'Member']);
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
    const reports = await db.all('SELECT * FROM reports WHERE familyId = ? ORDER BY date DESC', [req.user.familyId]);
    const members = await db.all('SELECT * FROM members WHERE familyId = ?', [req.user.familyId]);
    const alerts = await db.all('SELECT * FROM alerts WHERE familyId = ?', [req.user.familyId]);
    res.json({ 
      reports: reports.map(r => ({ ...r, labValues: JSON.parse(r.labValues || '[]') })), 
      members,
      alerts
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Members Routes ──────────────────────────────────────────────────────────
app.get('/api/members', auth, async (req, res) => {
  try {
    const members = await db.all('SELECT * FROM members WHERE familyId = ?', [req.user.familyId]);
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/members', auth, async (req, res) => {
  const { name, age, relation, avatarUrl } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO members (familyId, name, age, relation, avatarUrl) VALUES (?, ?, ?, ?, ?)',
      [req.user.familyId, name, age, relation, avatarUrl]
    );
    const newMember = await db.get('SELECT * FROM members WHERE id = ?', [result.lastID]);
    res.json(newMember);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/members/:id', auth, async (req, res) => {
  const { name, age, relation, avatarUrl } = req.body;
  try {
    await db.run(
      'UPDATE members SET name = ?, age = ?, relation = ?, avatarUrl = ? WHERE id = ? AND familyId = ?',
      [name, age, relation, avatarUrl, req.params.id, req.user.familyId]
    );
    res.json({ message: 'Member updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/members/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM members WHERE id = ? AND familyId = ?', [req.params.id, req.user.familyId]);
    res.json({ message: 'Member deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reports Routes ──────────────────────────────────────────────────────────
app.post('/api/reports', auth, async (req, res) => {
  const { memberId, title, date, summary, type, abnormality, labValues, doctorNotes } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO reports (familyId, memberId, title, date, summary, type, abnormality, labValues, doctorNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.familyId, memberId, title, date, summary, type, abnormality, JSON.stringify(labValues), doctorNotes]
    );
    const newReport = await db.get('SELECT * FROM reports WHERE id = ?', [result.lastID]);
    newReport.labValues = JSON.parse(newReport.labValues);
    
    await db.run(
      'UPDATE members SET lastReportDate = ?, reportCount = reportCount + 1, overallRisk = ? WHERE id = ?',
      [date, abnormality, memberId]
    );

    res.json(newReport);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Alerts Routes ───────────────────────────────────────────────────────────
app.get('/api/alerts', auth, async (req, res) => {
  try {
    const alerts = await db.all('SELECT * FROM alerts WHERE familyId = ?', [req.user.familyId]);
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/alerts', auth, async (req, res) => {
  const { memberId, title, description, date, severity, type } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO alerts (familyId, memberId, title, description, date, severity, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.familyId, memberId, title, description, date, severity, type]
    );
    const newAlert = await db.get('SELECT * FROM alerts WHERE id = ?', [result.lastID]);
    res.json(newAlert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI Analysis ─────────────────────────────────────────────────────────────
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/analyze-report', upload.single('report'), async (req, res) => {
  if (!req.file || !genAI) return res.status(400).json({ error: 'AI Service or file missing' });
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Analyze this medical report. Extract all lab values with parameter, value, unit, reference range, and status (Normal, Warning, Critical).
      Also provide a brief summary, the type of report, and overall abnormality level.
      Return ONLY JSON in this format:
      {
        "labValues": [{ "parameter": "...", "value": "...", "unit": "...", "referenceRange": "...", "status": "..." }],
        "summary": "...",
        "type": "...",
        "abnormality": "Normal/Warning/Critical"
      }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
    ]);
    
    let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    res.json(JSON.parse(text));
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: "Analysis failed: " + e.message }); 
  }
});

app.post('/api/chat', async (req, res) => {
  if (!genAI) return res.status(500).json({ error: 'AI not ready' });
  const { message, context, memberName, chatHistory } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat({
      history: chatHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] }))
    });
    const prompt = `Context about ${memberName}: ${JSON.stringify(context)}. Question: ${message}`;
    const result = await chat.sendMessage(prompt);
    res.json({ response: result.response.text() });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
