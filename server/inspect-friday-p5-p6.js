import { db } from './db/database.js';

const slots = db.prepare(`
  SELECT ts.id, ts.day, ts.period_index, c.name as class_name, s.name as subject_name, s.code as subject_code, t.name as teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE ts.day = 'Friday' AND ts.period_index >= 5
  ORDER BY ts.period_index, c.name
`).all();

console.log('Friday slots after break count:', slots.length);
console.table(slots);
