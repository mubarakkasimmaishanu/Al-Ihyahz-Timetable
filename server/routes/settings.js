import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET all settings as key-value object
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE settings
router.post('/', (req, res) => {
  try {
    const updates = req.body;
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const [key, val] of Object.entries(updates)) {
      const storedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      upsertStmt.run(key, storedVal);
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
