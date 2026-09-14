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

// Move 1: In SS 1: Monday P4 ENG (Sumayya) <--> Thursday P4 DATA (Mubarak)
const m1_a = slots.find(s => s.class_name === 'SS 1' && s.day === 'Monday' && s.period_index === 4);
const m1_b = slots.find(s => s.class_name === 'SS 1' && s.day === 'Thursday' && s.period_index === 4);

// Move 2: In JS 1: Monday P7 COMP (Sumayya) <--> Tuesday P1 MATHS (Mubarak)
const m2_a = slots.find(s => s.class_name === 'JS 1' && s.day === 'Monday' && s.period_index === 7);
const m2_b = slots.find(s => s.class_name === 'JS 1' && s.day === 'Tuesday' && s.period_index === 1);

// Move 3: In SS 2: Wednesday P1 MATHS (Yusuf) <--> Wednesday P5 ENG (Sumayya)
const m3_a = slots.find(s => s.class_name === 'SS 2' && s.day === 'Wednesday' && s.period_index === 1);
const m3_b = slots.find(s => s.class_name === 'SS 2' && s.day === 'Wednesday' && s.period_index === 5);

console.log('Move 1:', m1_a.class_name, m1_a.day, 'P' + m1_a.period_index, m1_a.subject_name, '<-->', m1_b.day, 'P' + m1_b.period_index, m1_b.subject_name);
console.log('Move 2:', m2_a.class_name, m2_a.day, 'P' + m2_a.period_index, m2_a.subject_name, '<-->', m2_b.day, 'P' + m2_b.period_index, m2_b.subject_name);
console.log('Move 3:', m3_a.class_name, m3_a.day, 'P' + m3_a.period_index, m3_a.subject_name, '<-->', m3_b.day, 'P' + m3_b.period_index, m3_b.subject_name);

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

// Check clashes
const tMap = new Set();
let tClashes = 0;
for (const s of sim) {
  const k = `${s.teacher_id}-${s.day}-${s.period_index}`;
  if (tMap.has(k)) tClashes++;
  tMap.add(k);
}
console.log('Teacher clashes:', tClashes);

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
console.log('Class clashes:', cClashes);

// P8 check
const p8 = {};
for (const s of sim) {
  if (s.period_index === 8) p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
}
console.log('P8 counts:', p8);

// Print Sumayya's full schedule
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
console.log('\n--- M. SUMAYYA BALANCED SCHEDULE ---');
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
