require('dotenv').config();
const express = require('express');
const db = require('./db');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
} }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  if (error.message === 'Origin not allowed by CORS') return res.status(403).json({ message: 'Origin not allowed.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid data supplied.' });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier.' });
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

const port = Number(process.env.PORT) || 5000;
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  console.log(`Connected to SQLite database: ${process.env.DB_FILE || 'server/data/task-manager.sqlite'}`);
  app.listen(port, '0.0.0.0', () => console.log(`API listening on port ${port}`));
}
start().catch(error => { console.error('Failed to start server:', error.message); process.exit(1); });
