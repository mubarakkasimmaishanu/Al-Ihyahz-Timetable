import { seedDatabase } from './db/seed.js';
import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

console.log('--- Seeding Database ---');
seedDatabase();

console.log('--- Generating Timetable ---');
const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 5,
  maxRestarts: 50
});

const result = generator.generate(classes, teachers, subjects, allocations);
if (result.success) {
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insertSlot = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const slot of result.slots) {
    insertSlot.run(slot.class_id, slot.subject_id, slot.teacher_id, slot.day, slot.period_index, 0);
  }
  console.log(`Saved ${result.slots.length} conflict-free timetable slots.`);
} else {
  console.error('Failed to generate timetable:', result.diagnostics);
}
