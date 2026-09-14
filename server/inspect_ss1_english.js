import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

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

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Candidate 1: SS 1 Monday P4 ENG (Sumayya)
// Can SS 1 Monday P4 ENG swap with something in SS 1 on Wednesday or Friday?
// Let's inspect SS 1 on Wednesday and Friday:
const ss1Slots = slots.filter(s => s.class_name === 'SS 1');
const ss1MonEng = ss1Slots.find(s => s.day === 'Monday' && s.period_index === 4);
console.log('SS 1 Monday P4 ENG:', ss1MonEng);

console.log('\nSS 1 Wednesday slots:');
ss1Slots.filter(s => s.day === 'Wednesday').forEach(s => console.log(`  P${s.period_index} ${s.subject_name} (${s.teacher_name})`));

console.log('\nSS 1 Friday slots:');
ss1Slots.filter(s => s.day === 'Friday').forEach(s => console.log(`  P${s.period_index} ${s.subject_name} (${s.teacher_name})`));
