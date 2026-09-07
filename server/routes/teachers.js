import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET all teachers with workload statistics
router.get('/', (req, res) => {
  try {
    const teachers = db.prepare(`
      SELECT t.*, 
        COALESCE(SUM(a.periods_per_week), 0) AS total_periods,
        COUNT(DISTINCT a.class_id) AS total_classes
      FROM teachers t
      LEFT JOIN allocations a ON a.teacher_id = t.id
      GROUP BY t.id
      ORDER BY CASE WHEN t.code = 'MSH' THEN 0 ELSE 1 END, t.name ASC
    `).all();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE teacher
router.post('/', (req, res) => {
  try {
    const { name, code, phone, max_daily_periods } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and Code are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO teachers (name, code, phone, max_daily_periods)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, code.toUpperCase(), phone || '', max_daily_periods || 5);
    res.status(201).json({ id: Number(result.lastInsertRowid), name, code: code.toUpperCase(), phone, max_daily_periods: max_daily_periods || 5 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE teacher
router.put('/:id', (req, res) => {
  try {
    const { name, code, phone, max_daily_periods } = req.body;
    const stmt = db.prepare(`
      UPDATE teachers 
      SET name = ?, code = ?, phone = ?, max_daily_periods = ?
      WHERE id = ?
    `);
    stmt.run(name, code.toUpperCase(), phone || '', max_daily_periods || 5, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE teacher
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
