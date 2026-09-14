import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const db = new DatabaseSync('server/db/timetable.sqlite');

// Get slot IDs:
// Slot 1: SS 2 Friday P2 MATHS (Yusuf)
// Slot 2: SS 2 Thursday P6 ENG (Sumayya)
const s1 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  WHERE c.name = 'SS 2' AND ts.day = 'Friday' AND ts.period_index = 2 AND s.name LIKE '%MATH%'
`).get();

const s2 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  WHERE c.name = 'SS 2' AND ts.day = 'Thursday' AND ts.period_index = 6 AND s.name LIKE '%ENG%'
`).get();

console.log('Swapping:');
console.log('  Slot 1 (id ' + s1.id + '):', s1.day, 'P' + s1.period_index, s1.class_name, s1.subject_name, s1.teacher_name);
console.log('  Slot 2 (id ' + s2.id + '):', s2.day, 'P' + s2.period_index, s2.class_name, s2.subject_name, s2.teacher_name);

// Update database
const updateStmt = db.prepare('UPDATE timetable_slots SET day = ?, period_index = ? WHERE id = ?');
updateStmt.run('Thursday', 6, s1.id);
updateStmt.run('Friday', 2, s2.id);

console.log('Database updated successfully!');

// Re-fetch all slots and save to server/data/solved_246_slots.json
const allSlots = db.prepare(`
  SELECT class_id, subject_id, teacher_id, day, period_index, is_locked
  FROM timetable_slots
  ORDER BY day, period_index, class_id
`).all();

fs.writeFileSync('server/data/solved_246_slots.json', JSON.stringify(allSlots, null, 2), 'utf8');
console.log('Saved', allSlots.length, 'slots to server/data/solved_246_slots.json');
