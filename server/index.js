require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initializeDb } = require('./database');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let ai;
let genAI;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

let db;
initializeDb().then(database => { db = database; });

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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

// Routes
app.get('/', (req, res) => res.send('HealthAI Live! 🚀'));
app.get('/api/health', (req, res) => res.json({ status: 'online', ai: !!ai }));

app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const reports = await db.all('SELECT * FROM reports WHERE familyId = ?', [req.user.familyId]);
    const members = await db.all('SELECT * FROM members WHERE familyId = ?', [req.user.familyId]);
    res.json({ reports, members });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/predictions', (req, res) => res.json({ predictions: [] }));

const upload = multer({ storage: multer.memoryStorage() });

async function analyzeReportHandler(req, res) {
  if (!req.file || !ai) return res.status(400).json({ error: 'Missing file/AI' });
  try {
    const result = await ai.generateContent([
      "Analyze this medical report. Return ONLY JSON with summary, type, abnormality, and labValues.",
      { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
    ]);
    res.json(JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

app.post('/api/analyze-report', upload.single('report'), analyzeReportHandler);
app.post('/api/analyze_report', upload.single('report'), analyzeReportHandler);

app.listen(port, '0.0.0.0', () => console.log(`Server on ${port}`));
