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

// Find the two slots to swap:
// SS 2: Friday P2 MATHS (Yusuf)
// SS 2: Thursday P6 ENG (Sumayya)
const s1 = slots.find(s => s.class_name === 'SS 2' && s.day === 'Friday' && s.period_index === 2 && s.subject_name.includes('MATHS'));
const s2 = slots.find(s => s.class_name === 'SS 2' && s.day === 'Thursday' && s.period_index === 6 && s.subject_name.includes('ENG'));

console.log('Slot 1:', s1);
console.log('Slot 2:', s2);

// Apply swap in memory
const sim = slots.map(r => {
  if (r.id === s1.id) return { ...r, day: s2.day, period_index: s2.period_index };
  if (r.id === s2.id) return { ...r, day: s1.day, period_index: s1.period_index };
  return r;
});

// Full validation
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

// 1. Teacher clashes
const tClashes = [];
const tMap = new Map();
for (const s of sim) {
  const key = `${s.teacher_id}-${s.day}-${s.period_index}`;
  if (tMap.has(key)) {
    tClashes.push({ teacher: s.teacher_name, day: s.day, period: s.period_index });
  }
  tMap.set(key, true);
}
console.log('Teacher clashes:', tClashes.length, tClashes);

// 2. Class clashes
const cClashes = [];
const cMap = new Map();
for (const s of sim) {
  const key = `${s.class_id}-${s.day}-${s.period_index}`;
  if (cMap.has(key)) {
    // Paired electives share class_id, day, period
    const existing = cMap.get(key);
    const pairKeys = [
      ['GOVT', 'PHY'], ['CHEM', 'ECON'], ['BIO', 'LIT'],
      ['PHY', 'GOVT'], ['ECON', 'CHEM'], ['LIT', 'BIO']
    ];
    const isPaired = pairKeys.some(p => p[0] === existing.subject_name && p[1] === s.subject_name);
    if (!isPaired) {
      cClashes.push({ class: s.class_name, day: s.day, period: s.period_index, s1: existing.subject_name, s2: s.subject_name });
    }
  } else {
    cMap.set(key, s);
  }
}
console.log('Class clashes:', cClashes.length, cClashes);

// 3. P8 distribution
const p8 = {};
for (const s of sim) {
  if (s.period_index === 8) {
    p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
  }
}
console.log('P8 counts:', p8);

// 4. Sumayya consecutive runs
console.log('\n--- M. SUMAYYA NEW SCHEDULE ---');
for (const day of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Sumayya') && r.day === day);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  const line = periods.map(p => map[p] ? ('[P' + p + ': ' + map[p] + ']') : ('[P' + p + ': ---]')).join(' ');
  console.log(day.padEnd(10) + ': ' + line);
}

// 5. M. Yusuf new schedule
console.log('\n--- M. YUSUF NEW SCHEDULE ---');
for (const day of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Yusuf') && r.day === day);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  const line = periods.map(p => map[p] ? ('[P' + p + ': ' + map[p] + ']') : ('[P' + p + ': ---]')).join(' ');
  console.log(day.padEnd(10) + ': ' + line);
}

// 6. SS 2 new schedule
console.log('\n--- SS 2 NEW SCHEDULE ---');
for (const day of days) {
  const dSlots = sim.filter(r => r.class_name === 'SS 2' && r.day === day);
  const map = {};
  dSlots.forEach(r => {
    if (!map[r.period_index]) map[r.period_index] = [];
    map[r.period_index].push(r.subject_name);
  });
  const line = periods.map(p => map[p] ? ('[P' + p + ': ' + map[p].join('/') + ']') : ('[P' + p + ': ---]')).join(' ');
  console.log(day.padEnd(10) + ': ' + line);
}
