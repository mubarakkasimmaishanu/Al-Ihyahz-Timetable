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

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

console.log('M. SUMAYYA FREE PERIODS:');
for (const d of days) {
  const dSlots = slots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
  const busy = new Set(dSlots.map(s => s.period_index));
  const maxP = d === 'Friday' ? 4 : 8;
  const free = [];
  for (let p = 1; p <= maxP; p++) {
    if (!busy.has(p)) free.push(`P${p}`);
  }
  console.log(`  ${d.padEnd(10)}: Free at [${free.join(', ')}] | Busy (${dSlots.length}): [${dSlots.map(s => `P${s.period_index} ${s.class_name}`).join(', ')}]`);
}
