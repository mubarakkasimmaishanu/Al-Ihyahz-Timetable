import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

const rows = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

console.log('--- TESTING JS 1 SWAPS ACROSS DAYS FOR COMP ---');

// JS 1 slots
const js1Slots = rows.filter(r => r.class_name === 'JS 1');
const compThu = js1Slots.find(r => r.day === 'Thursday' && r.subject_name.includes('COMP'));
console.log('Target slot to move:', compThu);

// For every other slot in JS 1:
for (const other of js1Slots) {
  if (other.id === compThu.id) continue;
  if (other.period_index === 8) continue; // avoid messing up P8 unless intentional
  if (other.day === 'Thursday') continue; // we want to see other days first

  // Can compThu move to other.day and other.period_index?
  // Teacher of compThu is Sumayya. Is Sumayya free at (other.day, other.period_index)?
  const sumayyaBusy = rows.some(r => r.teacher_name.includes('Sumayya') && r.day === other.day && r.period_index === other.period_index);
  if (sumayyaBusy) continue;

  // Can other.teacher move to Thursday P7?
  const otherTeacherBusy = rows.some(r => r.teacher_id === other.teacher_id && r.day === 'Thursday' && r.period_index === 7);
  if (otherTeacherBusy) continue;

  // Also check if other is part of a double period
  // Let's see what `other` is:
  console.log(`Valid swap candidate: Thursday P7 COMP <--> ${other.day} P${other.period_index} ${other.subject_name} (${other.teacher_name})`);
}
