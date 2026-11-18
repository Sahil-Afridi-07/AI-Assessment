const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/error');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, aiProvider: process.env.AI_PROVIDER || 'mock' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/practice', require('./routes/practice'));
app.use('/api/student', require('./routes/student'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/jobroles', require('./routes/jobroles'));

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

module.exports = app;
