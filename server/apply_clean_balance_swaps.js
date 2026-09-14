import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const db = new DatabaseSync('server/db/timetable.sqlite');

// Move A: JS 1: Monday P7 COMP (Sumayya) <--> Tuesday P1 MATHS (Mubarak)
const sA_1 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 1' AND ts.day = 'Monday' AND ts.period_index = 7
`).get();

const sA_2 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 1' AND ts.day = 'Tuesday' AND ts.period_index = 1
`).get();

// Move B: JS 3: Wednesday P7 COMP (Sumayya) <--> Wednesday P1 NV (Maryam)
const sB_1 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 3' AND ts.day = 'Wednesday' AND ts.period_index = 7
`).get();

const sB_2 = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN classes c ON ts.class_id = c.id
  WHERE c.name = 'JS 3' AND ts.day = 'Wednesday' AND ts.period_index = 1
`).get();

console.log('Applying Move A (JS 1):');
console.log(`  id ${sA_1.id} (${sA_1.day} P${sA_1.period_index}) <--> id ${sA_2.id} (${sA_2.day} P${sA_2.period_index})`);
console.log('Applying Move B (JS 3):');
console.log(`  id ${sB_1.id} (${sB_1.day} P${sB_1.period_index}) <--> id ${sB_2.id} (${sB_2.day} P${sB_2.period_index})`);

const updateStmt = db.prepare('UPDATE timetable_slots SET day = ?, period_index = ? WHERE id = ?');
updateStmt.run(sA_2.day, sA_2.period_index, sA_1.id);
updateStmt.run(sA_1.day, sA_1.period_index, sA_2.id);

updateStmt.run(sB_2.day, sB_2.period_index, sB_1.id);
updateStmt.run(sB_1.day, sB_1.period_index, sB_2.id);

console.log('Database updated successfully!');

// Re-fetch all slots and save to server/data/solved_246_slots.json
const allSlots = db.prepare(`
  SELECT class_id, subject_id, teacher_id, day, period_index, is_locked
  FROM timetable_slots
  ORDER BY day, period_index, class_id
`).all();

fs.writeFileSync('server/data/solved_246_slots.json', JSON.stringify(allSlots, null, 2), 'utf8');
console.log('Saved', allSlots.length, 'slots to server/data/solved_246_slots.json');
