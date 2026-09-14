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

console.log('Total slots:', rows.length);

// Let's examine Thursday specifically
console.log('\n--- THURSDAY ALL CLASSES ---');
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

for (const c of classes) {
  const cRows = rows.filter(r => r.class_name === c && r.day === 'Thursday');
  const map = {};
  cRows.forEach(r => {
    if (!map[r.period_index]) map[r.period_index] = [];
    map[r.period_index].push(`${r.subject_name} (${r.teacher_name})`);
  });
  const line = periods.map(p => `P${p}: ${map[p] ? map[p].join('/') : 'FREE'}`).join(' | ');
  console.log(`${c.padEnd(5)}: ${line}`);
}

// Check Sumayya slots on Thursday
const sumayyaThu = rows.filter(r => r.teacher_name.includes('Sumayya') && r.day === 'Thursday');
console.log('\nSumayya Thursday slots:', sumayyaThu.map(r => `P${r.period_index} in ${r.class_name} (${r.subject_name})`));
