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

let baseSim = slots.map(r => {
  if (r.id === m1_a.id) return { ...r, day: m1_b.day, period_index: m1_b.period_index };
  if (r.id === m1_b.id) return { ...r, day: m1_a.day, period_index: m1_a.period_index };
  return r;
}).map(r => {
  if (r.id === m2_a.id) return { ...r, day: m2_b.day, period_index: m2_b.period_index };
  if (r.id === m2_b.id) return { ...r, day: m2_a.day, period_index: m2_a.period_index };
  return r;
});

// Let's test swaps on Wednesday:
// 1. In JS 2: can Wednesday P6 COMP swap with another period in JS 2?
// 2. In JS 3: can Wednesday P7 COMP swap with another period in JS 3?
// 3. In SS 2: can Wednesday P5 ENG swap with another period in SS 2?

const testClasses = ['JS 2', 'JS 3', 'SS 2'];
for (const cName of testClasses) {
  const cSlots = baseSim.filter(s => s.class_name === cName);
  const targetSlots = cSlots.filter(s => s.day === 'Wednesday' && s.teacher_name.includes('Sumayya'));
  for (const tSlot of targetSlots) {
    for (const other of cSlots) {
      if (other.id === tSlot.id) continue;
      if (other.period_index === 8) continue;
      if (other.day === 'Friday' && (cName.startsWith('JS') ? other.period_index > 4 : other.period_index > 6)) continue;
      if ((other.teacher_name.includes('Shehu') || other.teacher_name.includes('Kabir')) && tSlot.day === 'Friday') continue;

      // Check teacher clashes
      const clash1 = baseSim.some(r => r.id !== tSlot.id && r.id !== other.id && r.teacher_id === tSlot.teacher_id && r.day === other.day && r.period_index === other.period_index);
      const clash2 = baseSim.some(r => r.id !== tSlot.id && r.id !== other.id && r.teacher_id === other.teacher_id && r.day === tSlot.day && r.period_index === tSlot.period_index);
      if (clash1 || clash2) continue;

      // Simulate
      const sim = baseSim.map(r => {
        if (r.id === tSlot.id) return { ...r, day: other.day, period_index: other.period_index };
        if (r.id === other.id) return { ...r, day: tSlot.day, period_index: tSlot.period_index };
        return r;
      });

      // Check Sumayya Wednesday afternoon run
      const wedSlots = sim.filter(r => r.teacher_name.includes('Sumayya') && r.day === 'Wednesday' && r.period_index >= 5);
      const pSet = new Set(wedSlots.map(s => s.period_index));
      let has3 = false;
      for (let p = 5; p <= 6; p++) {
        if (pSet.has(p) && pSet.has(p+1) && pSet.has(p+2)) has3 = true;
      }
      if (!has3) {
        console.log(`FOUND CLEAN WEDNESDAY BREAK in ${cName}:`);
        console.log(`  [Wednesday P${tSlot.period_index}] ${tSlot.subject_name} <--> [${other.day} P${other.period_index}] ${other.subject_name} (${other.teacher_name})`);
      }
    }
  }
}
