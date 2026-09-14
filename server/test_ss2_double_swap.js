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

console.log('Testing swap of SS 2 Wednesday P1-P2 (MATHS - Yusuf) with Thursday P5-P6 (ENG - Sumayya)...');

// Check Sumayya on Wednesday P1 and P2:
const sumayyaWedMorning = rows.filter(r => r.teacher_name.includes('Sumayya') && r.day === 'Wednesday' && (r.period_index === 1 || r.period_index === 2));
console.log('Sumayya on Wednesday P1-P2:', sumayyaWedMorning.map(r => `${r.class_name} ${r.subject_name}`));

// Check Yusuf on Thursday P5 and P6:
const yusufThuAfternoon = rows.filter(r => r.teacher_name.includes('Yusuf') && r.day === 'Thursday' && (r.period_index === 5 || r.period_index === 6));
console.log('Yusuf on Thursday P5-P6:', yusufThuAfternoon.map(r => `${r.class_name} ${r.subject_name}`));
