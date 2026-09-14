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

const m3_a = slots.find(s => s.class_name === 'SS 2' && s.day === 'Wednesday' && s.period_index === 1);
const m3_b = slots.find(s => s.class_name === 'SS 2' && s.day === 'Wednesday' && s.period_index === 5);

let sim = slots.map(r => {
  if (r.id === m1_a.id) return { ...r, day: m1_b.day, period_index: m1_b.period_index };
  if (r.id === m1_b.id) return { ...r, day: m1_a.day, period_index: m1_a.period_index };
  return r;
});

sim = sim.map(r => {
  if (r.id === m2_a.id) return { ...r, day: m2_b.day, period_index: m2_b.period_index };
  if (r.id === m2_b.id) return { ...r, day: m2_a.day, period_index: m2_a.period_index };
  return r;
});

sim = sim.map(r => {
  if (r.id === m3_a.id) return { ...r, day: m3_b.day, period_index: m3_b.period_index };
  if (r.id === m3_b.id) return { ...r, day: m3_a.day, period_index: m3_a.period_index };
  return r;
});

const tMap = new Map();
for (const s of sim) {
  const k = `${s.teacher_name}-${s.day}-P${s.period_index}`;
  if (tMap.has(k)) {
    console.log('CLASH DETECTED:', k, 'with', s.class_name, s.subject_name, 'and', tMap.get(k));
  } else {
    tMap.set(k, `${s.class_name} ${s.subject_name}`);
  }
}
