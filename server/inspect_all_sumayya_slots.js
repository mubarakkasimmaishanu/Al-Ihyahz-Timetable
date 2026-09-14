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

// Let's inspect all 9 Computer slots:
const compSlots = rows.filter(r => r.subject_name.includes('COMP'));
console.log('All 9 Computer slots:');
compSlots.forEach(s => console.log(`  ${s.class_name}: ${s.day} P${s.period_index} (id: ${s.id})`));

// Let's inspect all 15 English slots:
const engSlots = rows.filter(r => r.teacher_name.includes('Sumayya') && r.subject_name.includes('ENG'));
console.log('\nAll 15 English slots (Sumayya):');
engSlots.forEach(s => console.log(`  ${s.class_name}: ${s.day} P${s.period_index} (id: ${s.id})`));
