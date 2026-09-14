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

// Check clashes
const tMap = new Set();
let tClashes = 0;
for (const s of sim) {
  const k = `${s.teacher_id}-${s.day}-${s.period_index}`;
  if (tMap.has(k)) {
    tClashes++;
    console.log('Teacher clash:', s.teacher_name, s.day, s.period_index);
  }
  tMap.add(k);
}
console.log('Total teacher clashes:', tClashes);

const cMap = new Map();
let cClashes = 0;
const paired = [
  ['GOVT', 'PHY'], ['PHY', 'GOVT'],
  ['CHEM', 'ECON'], ['ECON', 'CHEM'],
  ['BIO', 'LIT'], ['LIT', 'BIO']
];
for (const s of sim) {
  const k = `${s.class_id}-${s.day}-${s.period_index}`;
  if (cMap.has(k)) {
    const prev = cMap.get(k);
    const isP = paired.some(p => p[0] === prev && p[1] === s.subject_name);
    if (!isP) cClashes++;
  } else {
    cMap.set(k, s.subject_name);
  }
}
console.log('Total class clashes:', cClashes);

// P8 check
const p8 = {};
for (const s of sim) {
  if (s.period_index === 8) p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
}
console.log('P8 counts:', p8);

// Print Sumayya's full schedule
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
console.log('\n--- M. SUMAYYA FULL WEEKLY SCHEDULE ---');
for (const d of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Sumayya') && r.day === d);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  console.log(d.padEnd(10) + ': ' + [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' '));
}

// Daily load
console.log('\nDaily contact counts for Sumayya:');
for (const d of days) {
  const count = sim.filter(r => r.teacher_name.includes('Sumayya') && r.day === d).length;
  console.log(`  ${d}: ${count}`);
}
