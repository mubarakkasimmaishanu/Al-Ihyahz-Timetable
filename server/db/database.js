import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'timetable.sqlite');

export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  // Foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Settings table (key-value store)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Classes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      level TEXT NOT NULL,
      arm TEXT,
      room TEXT,
      class_teacher TEXT
    );
  `);

  // Teachers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      phone TEXT,
      max_daily_periods INTEGER DEFAULT 5,
      time_preference TEXT DEFAULT 'ANY'
    );
  `);

  try {
    db.exec("ALTER TABLE teachers ADD COLUMN time_preference TEXT DEFAULT 'ANY';");
  } catch {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE teachers ADD COLUMN unavailable_days TEXT DEFAULT '[]';");
  } catch {
    // Column already exists
  }

  // Subjects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      category TEXT DEFAULT 'General',
      color TEXT DEFAULT '#198754'
    );
  `);

  // Allocations table (Subject taught in a Class by a Teacher for N periods/week)
  db.exec(`
    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      periods_per_week INTEGER NOT NULL,
      allow_double INTEGER DEFAULT 0,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      UNIQUE(class_id, subject_id)
    );
  `);

  // Timetable slots table (Stores the active generated timetable)
  db.exec(`
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      period_index INTEGER NOT NULL,
      is_locked INTEGER DEFAULT 0,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      UNIQUE(class_id, subject_id, day, period_index),
      UNIQUE(teacher_id, day, period_index)
    );
  `);

  // Default settings if not already present
  const defaultSettings = [
    { key: 'school_name', value: 'AL-IHYAZ ACADEMY' },
    { key: 'school_motto', value: 'Knowledge and Excellence' },
    { key: 'school_address', value: 'Northern Region, Nigeria' },
    { key: 'academic_session', value: '2025/26' },
    { key: 'current_term', value: 'First Term' },
    { key: 'days_of_week', value: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) },
    { key: 'regular_periods_per_day', value: '8' },
    { key: 'friday_periods_per_day', value: '6' },
    {
      key: 'period_times',
      value: JSON.stringify([
        { period: 0, type: 'assembly', name: 'ASSEMBLY', start: '7:40', end: '8:10' },
        { period: 1, start: '8:10', end: '8:40', label: '1' },
        { period: 2, start: '8:40', end: '9:20', label: '2' },
        { period: 3, start: '9:20', end: '10:00', label: '3' },
        { period: 4, start: '10:00', end: '10:40', label: '4' },
        { period: 0, type: 'break', name: 'BREAK FAST', start: '10:40', end: '11:10' },
        { period: 5, start: '11:10', end: '11:50', label: '5' },
        { period: 6, start: '11:50', end: '12:30', label: '6' },
        { period: 7, start: '12:30', end: '1:10', label: '7' },
        { period: 8, start: '1:10', end: '1:50', label: '8' }
      ])
    }
  ];

  const checkStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  for (const s of defaultSettings) {
    const existing = checkStmt.get(s.key);
    if (!existing) {
      insertStmt.run(s.key, s.value);
    }
  }
}
