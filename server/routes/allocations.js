import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET all allocations with details
router.get('/', (req, res) => {
  try {
    const { class_id, teacher_id } = req.query;
    let query = `
      SELECT 
        a.id, a.class_id, a.subject_id, a.teacher_id, a.periods_per_week, a.allow_double,
        c.name AS class_name, c.level AS class_level,
        s.name AS subject_name, s.code AS subject_code, s.color AS subject_color, s.category AS subject_category,
        t.name AS teacher_name, t.code AS teacher_code
      FROM allocations a
      JOIN classes c ON c.id = a.class_id
      JOIN subjects s ON s.id = a.subject_id
      JOIN teachers t ON t.id = a.teacher_id
    `;
    const params = [];
    const conditions = [];

    if (class_id) {
      conditions.push('a.class_id = ?');
      params.push(class_id);
    }
    if (teacher_id) {
      conditions.push('a.teacher_id = ?');
      params.push(teacher_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.name ASC, s.name ASC';
    const allocations = db.prepare(query).all(...params);
    res.json(allocations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE allocation
router.post('/', (req, res) => {
  try {
    const { class_id, subject_id, teacher_id, periods_per_week, allow_double } = req.body;
    if (!class_id || !subject_id || !teacher_id || !periods_per_week) {
      return res.status(400).json({ error: 'Class, Subject, Teacher, and Periods are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO allocations (class_id, subject_id, teacher_id, periods_per_week, allow_double)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(class_id, subject_id, teacher_id, periods_per_week, allow_double ? 1 : 0);
    res.status(201).json({ id: Number(result.lastInsertRowid), class_id, subject_id, teacher_id, periods_per_week, allow_double: allow_double ? 1 : 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE allocation
router.put('/:id', (req, res) => {
  try {
    const { teacher_id, periods_per_week, allow_double } = req.body;
    const stmt = db.prepare(`
      UPDATE allocations 
      SET teacher_id = ?, periods_per_week = ?, allow_double = ?
      WHERE id = ?
    `);
    stmt.run(teacher_id, periods_per_week, allow_double ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE allocation
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM allocations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
