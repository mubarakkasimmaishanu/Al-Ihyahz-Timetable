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

// Find JS 2 Monday P2 BST (Firdaus) and JS 2 Monday P6 IRS (Nabila)
const s1 = slots.find(s => s.class_name === 'JS 2' && s.day === 'Monday' && s.period_index === 2);
const s2 = slots.find(s => s.class_name === 'JS 2' && s.day === 'Monday' && s.period_index === 6);

console.log('Swap candidate:');
console.log('  s1:', s1.class_name, s1.day, 'P' + s1.period_index, s1.subject_name, s1.teacher_name);
console.log('  s2:', s2.class_name, s2.day, 'P' + s2.period_index, s2.subject_name, s2.teacher_name);

// Simulate swap
const sim = slots.map(r => {
  if (r.id === s1.id) return { ...r, period_index: s2.period_index };
  if (r.id === s2.id) return { ...r, period_index: s1.period_index };
  return r;
});

// Check teacher clashes
const tMap = new Set();
let tClashes = 0;
for (const s of sim) {
  const key = `${s.teacher_id}-${s.day}-${s.period_index}`;
  if (tMap.has(key)) tClashes++;
  tMap.add(key);
}
console.log('Teacher clashes:', tClashes);

// Check class clashes
const cMap = new Set();
let cClashes = 0;
for (const s of sim) {
  // Paired subjects check
  const isPaired = ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(s.subject_name);
  if (!isPaired) {
    const key = `${s.class_id}-${s.day}-${s.period_index}`;
    if (cMap.has(key)) cClashes++;
    cMap.add(key);
  }
}
console.log('Class clashes:', cClashes);

// Check P8
const p8 = {};
for (const s of sim) {
  if (s.period_index === 8) p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
}
console.log('P8 counts:', p8);

// Check Nabila runs
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
console.log('\n--- NEW M. NABILA SCHEDULE ---');
for (const d of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Nabila') && r.day === d);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  const line = [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' ');
  console.log(d.padEnd(10) + ': ' + line);
}

// Check Nana Firdaus runs
console.log('\n--- NEW M. NANA FIRDAUS SCHEDULE ---');
for (const d of days) {
  const dSlots = sim.filter(r => r.teacher_name.includes('Nana Firdaus') && r.day === d);
  const map = {};
  dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  const line = [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' ');
  console.log(d.padEnd(10) + ': ' + line);
}
