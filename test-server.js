const express = require('express');
const app = express();
app.get('/api/health', (req, res) => res.json({ status: 'bare-bones-online' }));
app.listen(3001, () => console.log('Bare bones server live on 3001! 🚀'));
