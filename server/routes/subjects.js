import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET all subjects
router.get('/', (req, res) => {
  try {
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY name ASC').all();
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE subject
router.post('/', (req, res) => {
  try {
    const { name, code, category, color } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Subject name and code are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO subjects (name, code, category, color)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, code.toUpperCase(), category || 'General', color || '#198754');
    res.status(201).json({ id: Number(result.lastInsertRowid), name, code: code.toUpperCase(), category, color });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE subject
router.put('/:id', (req, res) => {
  try {
    const { name, code, category, color } = req.body;
    const stmt = db.prepare(`
      UPDATE subjects 
      SET name = ?, code = ?, category = ?, color = ?
      WHERE id = ?
    `);
    stmt.run(name, code.toUpperCase(), category || 'General', color || '#198754', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE subject
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
