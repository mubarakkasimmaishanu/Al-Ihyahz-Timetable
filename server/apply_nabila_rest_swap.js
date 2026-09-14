import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const db = new DatabaseSync('server/db/timetable.sqlite');

const s1 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 2' AND ts.day = 'Monday' AND ts.period_index = 2
`).get();

const s2 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 2' AND ts.day = 'Monday' AND ts.period_index = 6
`).get();

console.log('Applying swap:');
console.log('  s1 id:', s1.id, 'P' + s1.period_index, '-> P6');
console.log('  s2 id:', s2.id, 'P' + s2.period_index, '-> P2');

const updateStmt = db.prepare('UPDATE timetable_slots SET period_index = ? WHERE id = ?');
updateStmt.run(6, s1.id);
updateStmt.run(2, s2.id);

console.log('Database updated successfully!');

// Sync solved_246_slots.json
const allSlots = db.prepare(`
  SELECT class_id, subject_id, teacher_id, day, period_index, is_locked
  FROM timetable_slots
  ORDER BY day, period_index, class_id
`).all();

fs.writeFileSync('server/data/solved_246_slots.json', JSON.stringify(allSlots, null, 2), 'utf8');
console.log('Saved', allSlots.length, 'slots to server/data/solved_246_slots.json');
