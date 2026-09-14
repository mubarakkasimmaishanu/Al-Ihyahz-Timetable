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

const m1_a = slots.find(s => s.class_name === 'SS 1' && s.day === 'Monday' && s.period_index === 4);
const m1_b = slots.find(s => s.class_name === 'SS 1' && s.day === 'Thursday' && s.period_index === 4);

const m2_a = slots.find(s => s.class_name === 'JS 1' && s.day === 'Monday' && s.period_index === 7);
const m2_b = slots.find(s => s.class_name === 'JS 1' && s.day === 'Tuesday' && s.period_index === 1);

const m3_a = slots.find(s => s.class_name === 'JS 3' && s.day === 'Wednesday' && s.period_index === 7);
const m3_b = slots.find(s => s.class_name === 'JS 3' && s.day === 'Wednesday' && s.period_index === 1);

let sim = slots.map(r => {
  if (r.id === m1_a.id) return { ...r, day: m1_b.day, period_index: m1_b.period_index };
  if (r.id === m1_b.id) return { ...r, day: m1_a.day, period_index: m1_a.period_index };
  return r;
}).map(r => {
  if (r.id === m2_a.id) return { ...r, day: m2_b.day, period_index: m2_b.period_index };
  if (r.id === m2_b.id) return { ...r, day: m2_a.day, period_index: m2_a.period_index };
  return r;
}).map(r => {
  if (r.id === m3_a.id) return { ...r, day: m3_b.day, period_index: m3_b.period_index };
  if (r.id === m3_b.id) return { ...r, day: m3_a.day, period_index: m3_a.period_index };
  return r;
});

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

console.log('--- M. MUBARAK SCHEDULE ---');
for (const d of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Mubarak') && r.day === d);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  console.log(d.padEnd(10) + ': ' + [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' '));
}

console.log('\n--- M. MARYAM SCHEDULE ---');
for (const d of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Maryam') && r.day === d);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  console.log(d.padEnd(10) + ': ' + [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' '));
}
