import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

let slots = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

const ss1Slots = slots.filter(s => s.class_name === 'SS 1');
const ss1MonEng = ss1Slots.find(s => s.day === 'Monday' && s.period_index === 4);

console.log('Testing swaps for SS 1 Monday P4 ENG:');
for (const other of ss1Slots) {
  if (other.id === ss1MonEng.id) continue;
  if (other.period_index === 8) continue;
  if (other.day === 'Monday') continue; // must be a different day to leave Monday P4 free!
  if (other.subject_name.includes('DATA') && other.period_index === 4) continue; // avoid DATA P4-P5
  const isP = ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(other.subject_name);
  if (isP) continue;

  // Check if Sumayya is free at other.day, other.period_index
  const sumayyaBusy = slots.some(r => r.teacher_name.includes('Sumayya') && r.day === other.day && r.period_index === other.period_index);
  if (sumayyaBusy) continue;

  // Check if other.teacher is free on Monday P4
  const otherBusy = slots.some(r => r.teacher_id === other.teacher_id && r.day === 'Monday' && r.period_index === 4);
  if (otherBusy) continue;

  console.log(`  VALID CLEAN SWAP: SS 1 Mon P4 ENG <--> SS 1 ${other.day} P${other.period_index} ${other.subject_name} (${other.teacher_name})`);
}
