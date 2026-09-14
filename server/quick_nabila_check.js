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
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

console.log('=== M. NABILA SCHEDULE ===');
for (const d of days) {
  const dSlots = slots.filter(s => s.teacher_name.includes('Nabila') && s.day === d);
  const map = {};
  dSlots.forEach(s => map[s.period_index] = s.class_name + ' ' + s.subject_name);
  console.log(d.padEnd(10) + ': ' + periods.map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' '));
}
