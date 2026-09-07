import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database.js';
import teachersRouter from './routes/teachers.js';
import classesRouter from './routes/classes.js';
import subjectsRouter from './routes/subjects.js';
import allocationsRouter from './routes/allocations.js';
import settingsRouter from './routes/settings.js';
import timetableRouter from './routes/timetable.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize SQLite database and default settings
initDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/teachers', teachersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/timetable', timetableRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Al-Ihyahz School Timetable Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
