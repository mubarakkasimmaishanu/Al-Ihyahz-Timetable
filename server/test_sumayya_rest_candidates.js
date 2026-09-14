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

// Let's test swaps on Thursday in JS 1, JS 2, JS 3, SS 1, SS 2, SS 3
console.log('Testing swaps to break Thursday P5-P8 for Sumayya...');

// Candidate 1: Within JS 1 on Thursday:
// JS 1 has slots:
const js1Thu = rows.filter(r => r.class_name === 'JS 1' && r.day === 'Thursday');
console.log('JS 1 Thursday:');
js1Thu.forEach(r => console.log(`  P${r.period_index}: ${r.subject_name} (${r.teacher_name})`));

// Candidate 2: Within JS 3 on Thursday:
const js3Thu = rows.filter(r => r.class_name === 'JS 3' && r.day === 'Thursday');
console.log('JS 3 Thursday:');
js3Thu.forEach(r => console.log(`  P${r.period_index}: ${r.subject_name} (${r.teacher_name})`));

// Candidate 3: Across days for JS 1 COMP:
// JS 1 COMP is currently at Monday P7, Thursday P7, Tuesday P8.
// Could Thursday P7 swap with JS 1 Wednesday?
const js1Wed = rows.filter(r => r.class_name === 'JS 1' && r.day === 'Wednesday');
console.log('JS 1 Wednesday:');
js1Wed.forEach(r => console.log(`  P${r.period_index}: ${r.subject_name} (${r.teacher_name})`));

// Candidate 4: Across days for JS 3 COMP:
// JS 3 COMP is Monday P6, Wednesday P7, Thursday P8.
const js3Wed = rows.filter(r => r.class_name === 'JS 3' && r.day === 'Wednesday');
console.log('JS 3 Wednesday:');
js3Wed.forEach(r => console.log(`  P${r.period_index}: ${r.subject_name} (${r.teacher_name})`));
