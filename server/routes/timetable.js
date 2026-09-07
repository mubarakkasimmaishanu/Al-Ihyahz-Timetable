import express from 'express';
import { db } from '../db/database.js';
import { TimetableGenerator } from '../engine/generator.js';
import { validateTimetable } from '../engine/validator.js';
import { seedDatabase } from '../db/seed.js';

const router = express.Router();

// Helper to get enriched timetable slots
function getEnrichedSlots() {
  return db.prepare(`
    SELECT 
      ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index, ts.is_locked,
      c.name AS class_name, c.level AS class_level, c.arm AS class_arm, c.room AS class_room, c.class_teacher,
      s.name AS subject_name, s.code AS subject_code, s.color AS subject_color, s.category AS subject_category,
      t.name AS teacher_name, t.code AS teacher_code, t.phone AS teacher_phone
    FROM timetable_slots ts
    JOIN classes c ON c.id = ts.class_id
    JOIN subjects s ON s.id = ts.subject_id
    JOIN teachers t ON t.id = ts.teacher_id
    ORDER BY ts.day ASC, ts.period_index ASC, c.name ASC
  `).all();
}

// GET current timetable slots
router.get('/', (req, res) => {
  try {
    const slots = getEnrichedSlots();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GENERATE timetable automatically
router.post('/generate', (req, res) => {
  try {
    const classes = db.prepare('SELECT * FROM classes').all();
    const teachers = db.prepare('SELECT * FROM teachers').all();
    const subjects = db.prepare('SELECT * FROM subjects').all();
    const allocations = db.prepare('SELECT * FROM allocations').all();
    const lockedSlots = db.prepare('SELECT * FROM timetable_slots WHERE is_locked = 1').all();

    // Fetch settings for periods
    const regularPeriods = Number(db.prepare("SELECT value FROM settings WHERE key = 'regular_periods_per_day'").get()?.value || 8);
    const fridayPeriods = Number(db.prepare("SELECT value FROM settings WHERE key = 'friday_periods_per_day'").get()?.value || 6);

    const generator = new TimetableGenerator({
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      regularPeriods,
      fridayPeriods,
      maxRestarts: 50
    });

    const result = generator.generate(classes, teachers, subjects, allocations, lockedSlots);

    if (result.success && result.slots.length > 0) {
      // Clear non-locked slots and save newly generated slots
      db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');

      const insertSlot = db.prepare(`
        INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
        VALUES (@class_id, @subject_id, @teacher_id, @day, @period_index, @is_locked)
      `);

      for (const slot of result.slots) {
        if (!slot.is_locked) {
          insertSlot.run(slot);
        }
      }

      const enrichedSlots = getEnrichedSlots();
      const validation = validateTimetable(enrichedSlots, classes, teachers, subjects, allocations, {
        fridayPeriods,
        regularPeriods
      });

      return res.json({
        success: true,
        message: 'Conflict-free timetable generated and saved successfully.',
        restarts: result.restarts,
        totalSlots: enrichedSlots.length,
        validation,
        slots: enrichedSlots
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Could not generate a 100% clash-free timetable with current constraints.',
        diagnostics: result.diagnostics,
        slots: []
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VALIDATE current timetable
router.get('/validate', (req, res) => {
  try {
    const slots = db.prepare('SELECT * FROM timetable_slots').all();
    const classes = db.prepare('SELECT * FROM classes').all();
    const teachers = db.prepare('SELECT * FROM teachers').all();
    const subjects = db.prepare('SELECT * FROM subjects').all();
    const allocations = db.prepare('SELECT * FROM allocations').all();

    const regularPeriods = Number(db.prepare("SELECT value FROM settings WHERE key = 'regular_periods_per_day'").get()?.value || 8);
    const fridayPeriods = Number(db.prepare("SELECT value FROM settings WHERE key = 'friday_periods_per_day'").get()?.value || 5);

    const validation = validateTimetable(slots, classes, teachers, subjects, allocations, {
      fridayPeriods,
      regularPeriods
    });

    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESET to demo Northern Nigerian dataset
router.post('/reset-demo', (req, res) => {
  try {
    seedDatabase();
    res.json({ success: true, message: 'Database reset to Northern Nigerian demo school data.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CLEAR all slots
router.delete('/clear', (req, res) => {
  try {
    db.exec('DELETE FROM timetable_slots;');
    res.json({ success: true, message: 'All timetable slots cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
