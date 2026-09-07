import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// GET all classes with total allocated periods
router.get('/', (req, res) => {
  try {
    const classes = db.prepare(`
      SELECT c.*,
        COALESCE(SUM(a.periods_per_week), 0) AS total_periods,
        COUNT(a.id) AS subject_count
      FROM classes c
      LEFT JOIN allocations a ON a.class_id = c.id
      GROUP BY c.id
      ORDER BY 
        CASE 
          WHEN c.level = 'JSS' THEN 1 
          WHEN c.level = 'SSS' THEN 2 
          ELSE 3 
        END,
        c.name ASC
    `).all();
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE class
router.post('/', (req, res) => {
  try {
    const { name, level, arm, room, class_teacher } = req.body;
    if (!name || !level) {
      return res.status(400).json({ error: 'Class name and level are required' });
    }
    const stmt = db.prepare(`
      INSERT INTO classes (name, level, arm, room, class_teacher)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, level, arm || '', room || '', class_teacher || '');
    res.status(201).json({ id: Number(result.lastInsertRowid), name, level, arm, room, class_teacher });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE class
router.put('/:id', (req, res) => {
  try {
    const { name, level, arm, room, class_teacher } = req.body;
    const stmt = db.prepare(`
      UPDATE classes 
      SET name = ?, level = ?, arm = ?, room = ?, class_teacher = ?
      WHERE id = ?
    `);
    stmt.run(name, level, arm || '', room || '', class_teacher || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE class
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
