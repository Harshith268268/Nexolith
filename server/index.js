require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initializeDb } = require('./database');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');

const app = express();
const port = process.env.PORT || 3001; // Railway assigns PORT dynamically
const JWT_SECRET = process.env.JWT_SECRET || 'healthai_supersecret_jwt_key_2026';

// Allow all origins — needed for mobile app and Vercel frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage });

let ai;
try {
  // GoogleGenAI reads GOOGLE_GEMINI_API_KEY automatically, or we pass it explicitly
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log('Gemini AI initialized successfully.');
  } else {
    console.log('No Gemini API key found — AI features will use mock responses.');
  }
} catch (e) {
  console.log('Gemini API init error:', e.message);
}

let db;
initializeDb().then(database => {
  db = database;
  console.log('SQLite database initialized.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// ── Auth Middleware ────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO families (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    const familyId = result.lastID;
    const token = jwt.sign({ familyId, username }, JWT_SECRET);
    res.json({ token, familyId, username });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const family = await db.get('SELECT * FROM families WHERE username = ?', [username]);
    if (!family) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, family.password);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ familyId: family.id, username: family.username }, JWT_SECRET);
    res.json({ token, familyId: family.id, username: family.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Data Routes ───────────────────────────────────────────────────────────────
app.get('/api/data', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  try {
    const members = await db.all('SELECT * FROM members WHERE family_id = ?', [familyId]);
    const reportsRows = await db.all('SELECT * FROM reports WHERE family_id = ? ORDER BY date DESC', [familyId]);
    const alertsRows = await db.all('SELECT * FROM alerts WHERE family_id = ? ORDER BY date DESC', [familyId]);

    const reports = reportsRows.map(r => ({
      ...r,
      memberId: r.member_id,
      labValues: (() => { try { return JSON.parse(r.labValues); } catch { return []; } })()
    }));

    const alerts = alertsRows.map(a => ({
      ...a,
      memberId: a.member_id,
      read: Boolean(a.read)
    }));

    res.json({ members, reports, alerts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// ── Members ───────────────────────────────────────────────────────────────────
app.post('/api/members', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { name, age, relation, avatarUrl } = req.body;
  const id = crypto.randomUUID();
  const lastReportDate = new Date().toISOString().split('T')[0];

  try {
    await db.run(
      'INSERT INTO members (id, family_id, name, age, relation, avatarUrl, lastReportDate, reportCount, overallRisk) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      [id, familyId, name, age || 0, relation || 'Dependent', avatarUrl || '', lastReportDate, 'Normal']
    );
    res.json({ id, name, age: age || 0, relation: relation || 'Dependent', avatarUrl: avatarUrl || '', lastReportDate, reportCount: 0, overallRisk: 'Normal' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.put('/api/members/:id', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const memberId = req.params.id;
  const { name, age, relation, overallRisk, lastReportDate, reportCount, avatarUrl } = req.body;

  try {
    await db.run(
      'UPDATE members SET name=?, age=?, relation=?, overallRisk=?, lastReportDate=?, reportCount=?, avatarUrl=COALESCE(?, avatarUrl) WHERE id=? AND family_id=?',
      [name, age, relation, overallRisk, lastReportDate, reportCount, avatarUrl, memberId, familyId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.delete('/api/members/:id', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const memberId = req.params.id;

  try {
    // Delete associated alerts and reports first
    await db.run('DELETE FROM alerts WHERE member_id=? AND family_id=?', [memberId, familyId]);
    await db.run('DELETE FROM reports WHERE member_id=? AND family_id=?', [memberId, familyId]);
    
    // Delete the member
    await db.run('DELETE FROM members WHERE id=? AND family_id=?', [memberId, familyId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────
app.post('/api/reports', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { memberId, title, date, type, abnormality, summary, doctorNotes, labValues } = req.body;
  const id = crypto.randomUUID();

  try {
    await db.run(
      'INSERT INTO reports (id, family_id, member_id, title, date, type, abnormality, summary, doctorNotes, labValues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, familyId, memberId, title || 'Report', date, type || 'Blood', abnormality || 'Normal', summary || '', doctorNotes || '', JSON.stringify(labValues || [])]
    );

    // Update member's reportCount, lastReportDate, overallRisk
    const memberReports = await db.all('SELECT abnormality FROM reports WHERE member_id = ? AND family_id = ?', [memberId, familyId]);
    const reportCount = memberReports.length;
    const hasCritical = memberReports.some(r => r.abnormality === 'Critical');
    const hasBorderline = memberReports.some(r => r.abnormality === 'Borderline');
    const overallRisk = hasCritical ? 'Critical' : hasBorderline ? 'Borderline' : 'Normal';
    await db.run(
      'UPDATE members SET reportCount=?, lastReportDate=?, overallRisk=? WHERE id=? AND family_id=?',
      [reportCount, date, overallRisk, memberId, familyId]
    );

    res.json({ id, memberId, title, date, type, abnormality, summary, doctorNotes, labValues: labValues || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

app.get('/api/reports/:id', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  try {
    const report = await db.get('SELECT * FROM reports WHERE id = ? AND family_id = ?', [req.params.id, familyId]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({
      ...report,
      memberId: report.member_id,
      labValues: (() => { try { return JSON.parse(report.labValues); } catch { return []; } })()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// ── Alerts ────────────────────────────────────────────────────────────────────
app.post('/api/alerts', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { memberId, title, description, date, severity, type, status } = req.body;
  const id = crypto.randomUUID();

  try {
    await db.run(
      'INSERT INTO alerts (id, family_id, member_id, title, description, date, severity, type, status, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [id, familyId, memberId, title, description || '', date, severity || 'Normal', type || 'Reminder', status || 'Active']
    );
    res.json({ id, memberId, title, description, date, severity, type, status: status || 'Active', read: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

app.put('/api/alerts/:id/read', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  try {
    await db.run('UPDATE alerts SET read=1, status=? WHERE id=? AND family_id=?', ['History', req.params.id, familyId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

app.put('/api/alerts/:id/reschedule', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'New date is required' });
  try {
    await db.run('UPDATE alerts SET date=? WHERE id=? AND family_id=?', [date, req.params.id, familyId]);
    res.json({ success: true, date });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reschedule alert' });
  }
});

// ── AI: Predictions ────────────────────────────────────────────────────────────
app.get('/api/predictions', authenticateToken, async (req, res) => {
  const { familyId } = req.user;

  try {
    const members = await db.all('SELECT id, name FROM members WHERE family_id = ?', [familyId]);
    const reportsRows = await db.all('SELECT * FROM reports WHERE family_id = ? ORDER BY date DESC', [familyId]);

    if (reportsRows.length === 0) {
      return res.json({ predictions: [] });
    }

    if (!ai) {
      return res.json({ predictions: [
        { id: 'mock-p1', memberId: members[0]?.id || 'unknown', condition: 'Mock Prediction Active', riskLevel: 'Low', factors: ['No Gemini API Key'], suggestions: ['Add GEMINI_API_KEY to see real predictions'], reportCount: reportsRows.length }
      ]});
    }

    const reportsData = reportsRows.map(r => ({
      memberId: r.member_id,
      title: r.title,
      date: r.date,
      type: r.type,
      abnormality: r.abnormality,
      labValues: (() => { try { return JSON.parse(r.labValues); } catch { return []; } })()
    }));

    const prompt = `You are a medical AI. Analyze the following medical reports for a family.
Provide predictive health insights. Return ONLY a JSON array of prediction objects. Do not include markdown formatting or json backticks.
Each object MUST match this schema exactly:
{
  "id": "generate-a-unique-uuid",
  "memberId": "member ID exactly as provided in the reports",
  "condition": "Name of the condition at risk",
  "riskLevel": "Low", "Moderate", or "High",
  "factors": ["factor 1", "factor 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "reportCount": integer, number of reports analyzed for this specific member
}
Here are the reports to analyze:
${JSON.stringify(reportsData)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    let text = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const predictions = JSON.parse(text);
    
    res.json({ predictions: Array.isArray(predictions) ? predictions : [] });
  } catch (error) {
    console.error('Predictions error:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// ── AI: Analyze Report ────────────────────────────────────────────────────────
app.post('/api/analyze-report', upload.single('report'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  if (!ai) {
    return res.json({
      summary: 'AI analysis is not configured. This is a mock response.',
      type: 'Blood',
      abnormality: 'Normal',
      labValues: [
        { id: 'mock1', parameter: 'Hemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.8-17.2', status: 'Normal', date: new Date().toISOString().split('T')[0] },
        { id: 'mock2', parameter: 'Fasting Glucose', value: 105, unit: 'mg/dL', referenceRange: '70-99', status: 'Borderline', date: new Date().toISOString().split('T')[0] }
      ]
    });
  }

  try {
    const mimeType = req.file.mimetype;
    const base64Data = req.file.buffer.toString('base64');
    const today = new Date().toISOString().split('T')[0];

    // OCR Processing
    let extractedText = '';
    try {
      if (mimeType === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        extractedText = data.text;
      } else if (mimeType.startsWith('image/')) {
        const result = await Tesseract.recognize(req.file.buffer, 'eng');
        extractedText = result.data.text;
      }
    } catch (ocrError) {
      console.log('OCR Error (continuing with Gemini multimodal):', ocrError.message);
    }

    const prompt = `You are a medical data extraction assistant. Analyze this medical report and return a JSON object with exactly these keys:
1. "summary": A plain-language summary of the report.
2. "type": One of: "Blood", "Imaging", "Prescription", "Discharge"
3. "abnormality": One of: "Normal", "Borderline", "Critical" — based on overall findings
4. "labValues": An array of objects, each with:
   - "id": a unique string (use short uuid like "lv1", "lv2"...)
   - "parameter": string (e.g. "Hemoglobin")
   - "value": number
   - "unit": string
   - "referenceRange": string
   - "status": one of "Normal", "Borderline", "Critical"
   - "date": "${today}"
Return ONLY the raw JSON object, no markdown, no explanation.
${extractedText ? `\nHere is the OCR extracted text from the document to help ensure 100% accuracy:\n"""\n${extractedText}\n"""\n` : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }
      ]
    });

    let text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);
    res.json({
      summary: data.summary || 'Summary unavailable.',
      type: data.type || 'Blood',
      abnormality: data.abnormality || 'Normal',
      labValues: data.labValues || []
    });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Failed to analyze report', summary: 'An error occurred.', labValues: [] });
  }
});

// ── AI: Simplify Text ────────────────────────────────────────────────────────
app.post('/api/simplify', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  if (!ai) return res.json({ simplified: 'Mock simplification: This means your levels are normal.' });

  try {
    const prompt = `Explain the following medical term or notes in simple, plain English (5th-grade reading level), in 2-3 sentences. Do not include any markdown or formatting.\n\nText: "${text}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    res.json({ simplified: response.text.trim() });
  } catch (error) {
    console.error('Simplify error:', error);
    res.status(500).json({ error: 'Failed to simplify text' });
  }
});

// ── AI: Chat ──────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, context, memberName, chatHistory } = req.body;

  if (!ai) {
    return res.json({ response: "AI is not configured. Please check your GEMINI_API_KEY in server/.env and restart the server." });
  }

  try {
    const systemPrompt = `You are HealthAI, a helpful and empathetic medical AI assistant helping a family manage their health records.

You have access to the following medical records for ${memberName || 'the patient'}:
${JSON.stringify(context || [], null, 2)}

Instructions:
- When asked about specific lab values (e.g. "latest glucose level"), search the context above and give the exact value, date, and status.
- Be specific: mention exact numbers, dates, and which report they came from.
- If a value is borderline or critical, highlight it and suggest consulting a doctor.
- When the user asks for advice on how to improve health, decrease/increase lab values, or manage conditions, YOU MUST provide actionable, evidence-based lifestyle, dietary, and exercise recommendations. Do not refuse to answer. Provide the suggestions they asked for, followed by a brief disclaimer that they should also consult their doctor.
- Be concise, warm, and easy to understand — avoid excessive medical jargon.
- If no relevant data exists in the context, say so honestly.`;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: "Understood. I have reviewed the medical records and I'm ready to help answer questions about the patient's health data." }] }
    ];

    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach(msg => {
        if (msg.role !== 'system') {
          contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
        }
      });
    }

    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents });
    res.json({ response: response.text });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`HealthAI backend listening on port ${port}`);
});
