require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initializeDb } = require('./database');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');

const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
    res.send('HealthAI Backend is Live and Running!');
});

app.get('/api/health', (req, res) => {
    res.json({
          status: 'online',
          ai: !!ai,
          db: !!db,
          time: new Date().toISOString()
    });
});

console.log('--- SERVER STARTING UP ---');
console.log(`Target Port: ${port}`);
const JWT_SECRET = process.env.JWT_SECRET || 'healthai_supersecret_jwt_key_2026';

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
let genAI;
try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
          genAI = new GoogleGenerativeAI(apiKey);
          ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          console.log('Gemini AI initialized successfully.');
    } else {
          console.log('No Gemini API key found - AI features will use mock responses.');
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


app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    try {
          const hashedPassword = await bcrypt.hash(password, 10);
          const result = await db.run('INSERT INTO families (username, password) VALUES (?, ?)', [username, hashedPassword]);
          const familyId = result.lastID;
          const token = jwt.sign({ familyId, username }, JWT_SECRET);
          res.json({ token, familyId, username });
    } catch (error) {
          res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
          const family = await db.get('SELECT * FROM families WHERE username = ?', [username]);
          if (!family || !(await bcrypt.compare(password, family.password))) return res.status(401).json({ error: 'Invalid credentials' });
          const token = jwt.sign({ familyId: family.id, username: family.username }, JWT_SECRET);
          res.json({ token, familyId: family.id, username: family.username });
    } catch (error) {
          res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
          const reports = await db.all('SELECT * FROM reports WHERE familyId = ?', [req.user.familyId]);
          const parsedReports = reports.map(r => ({...r, labValues: JSON.parse(r.labValues || '[]')}));
          res.json(parsedReports);
    } catch (error) {
          res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

app.post('/api/reports', authenticateToken, async (req, res) => {
    const { memberId, title, date, type, abnormality, summary, doctorNotes, labValues } = req.body;
    try {
          const result = await db.run(
                  'INSERT INTO reports (familyId, memberId, title, date, type, abnormality, summary, doctorNotes, labValues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [req.user.familyId, memberId, title, date, type, abnormality, summary, doctorNotes, JSON.stringify(labValues)]
                );
          res.json({ id: result.lastID });
    } catch (error) {
          res.status(500).json({ error: 'Failed to save report' });
    }
});

app.get('/api/members', authenticateToken, async (req, res) => {
    try {
          const members = await db.all('SELECT * FROM members WHERE familyId = ?', [req.user.familyId]);
          res.json(members);
    } catch (error) {
          res.status(500).json({ error: 'Failed to fetch members' });
    }
});

app.post('/api/members', authenticateToken, async (req, res) => {
    const { name, relation, age, gender, bloodGroup, avatarUrl } = req.body;
    try {
          const result = await db.run(
                  'INSERT INTO members (familyId, name, relation, age, gender, bloodGroup, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [req.user.familyId, name, relation, age, gender, bloodGroup, avatarUrl]
                );
          res.json({ id: result.lastID });
    } catch (error) {
          res.status(500).json({ error: 'Failed to add member' });
    }
});

app.post('/api/analyze-report', upload.single('report'), async (req, res) => {
    if (!req.file || !ai) return res.status(400).json({ error: 'Missing file or AI' });
    try {
          const base64Data = req.file.buffer.toString('base64');
          const mimeType = req.file.mimetype;
          const prompt = "Analyze this medical report. Return ONLY a JSON object with 'summary', 'type', 'abnormality', and 'labValues' array.";
          const result = await ai.generateContent([prompt, { inlineData: { mimeType, data: base64Data } }]);
          const response = await result.response;
          let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
          res.json(JSON.parse(text));
    } catch (error) {
          res.status(500).json({ error: 'Failed to analyze report' });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message, context, memberName, chatHistory } = req.body;
    if (!ai) return res.json({ response: "AI not configured." });
    try {
          const contents = [{ role: 'user', parts: [{ text: `You are HealthAI. Patient: ${memberName}. Data: ${JSON.stringify(context)}. History: ${JSON.stringify(chatHistory)}. User says: ${message}` }] }];
          const result = await ai.generateContent(contents);
          const response = await result.response;
          res.json({ response: response.text() });
    } catch (error) {
          res.json({ response: "I'm sorry, I encountered an error. Please try again." });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`HealthAI backend listening on port ${port}`);
});
