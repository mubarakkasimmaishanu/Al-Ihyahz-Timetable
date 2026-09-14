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

// First apply the two swaps:
// 1. SS 1: Monday P4 ENG <--> Thursday P4 DATA (Mubarak)
// 2. JS 1: Monday P7 COMP <--> Tuesday P1 MATHS (Mubarak)

const sw1_a = slots.find(s => s.class_name === 'SS 1' && s.day === 'Monday' && s.period_index === 4);
const sw1_b = slots.find(s => s.class_name === 'SS 1' && s.day === 'Thursday' && s.period_index === 4);

const sw2_a = slots.find(s => s.class_name === 'JS 1' && s.day === 'Monday' && s.period_index === 7);
const sw2_b = slots.find(s => s.class_name === 'JS 1' && s.day === 'Tuesday' && s.period_index === 1);

let testSlots = slots.map(r => {
  if (r.id === sw1_a.id) return { ...r, day: sw1_b.day, period_index: sw1_b.period_index };
  if (r.id === sw1_b.id) return { ...r, day: sw1_a.day, period_index: sw1_a.period_index };
  return r;
});

testSlots = testSlots.map(r => {
  if (r.id === sw2_a.id) return { ...r, day: sw2_b.day, period_index: sw2_b.period_index };
  if (r.id === sw2_b.id) return { ...r, day: sw2_a.day, period_index: sw2_a.period_index };
  return r;
});

// Now let's find a swap on Wednesday for Sumayya:
// Sumayya on Wednesday currently has:
// P3: SS 3 ENG
// P4: SS 3 ENG
// P5: SS 2 ENG
// P6: JS 2 COMP
// P7: JS 3 COMP
// Can P6 JS 2 COMP swap with something else in JS 2?
const js2Slots = testSlots.filter(s => s.class_name === 'JS 2');
const js2WedComp = js2Slots.find(s => s.day === 'Wednesday' && s.period_index === 6);

console.log('Testing swaps for JS 2 Wednesday P6 COMP:');
for (const other of js2Slots) {
  if (other.id === js2WedComp.id) continue;
  if (other.period_index === 8) continue;
  if (other.day === 'Friday' && other.period_index > 4) continue;
  if (other.teacher_name.includes('Kabir') && other.day === 'Friday') continue;
  if (other.teacher_name.includes('Shehu') && other.day === 'Friday') continue;

  const clash1 = testSlots.some(r => r.id !== js2WedComp.id && r.id !== other.id && r.teacher_id === js2WedComp.teacher_id && r.day === other.day && r.period_index === other.period_index);
  const clash2 = testSlots.some(r => r.id !== js2WedComp.id && r.id !== other.id && r.teacher_id === other.teacher_id && r.day === js2WedComp.day && r.period_index === js2WedComp.period_index);
  if (clash1 || clash2) continue;

  console.log(`  Candidate: JS 2 Wed P6 COMP <--> ${other.day} P${other.period_index} ${other.subject_name} (${other.teacher_name})`);
}
