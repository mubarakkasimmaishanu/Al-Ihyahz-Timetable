import { db } from './db/database.js';

const allocs = db.prepare(`
  SELECT a.id, c.name as class_name, s.name as subject_name, s.code as subject_code, t.name as teacher_name, a.periods_per_week
  FROM allocations a
  JOIN classes c ON c.id = a.class_id
  JOIN subjects s ON s.id = a.subject_id
  JOIN teachers t ON t.id = a.teacher_id
  WHERE t.name = 'M. Abba'
`).all();

console.log('--- M. Abba Allocations in Database ---');
console.table(allocs);

const slots = db.prepare(`
  SELECT ts.id, ts.day, ts.period_index, c.name as class_name, s.name as subject_name, t.name as teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE t.name = 'M. Abba'
  ORDER BY c.name, ts.day, ts.period_index
`).all();

console.log('--- M. Abba Slots in Database ---');
console.table(slots);
