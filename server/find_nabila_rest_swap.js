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

function evalNabila(slotsList) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let maxRunMonAft = 0;
  let details = [];

  const monSlots = slotsList.filter(s => s.teacher_name.includes('Nabila') && s.day === 'Monday' && s.period_index >= 5);
  const pSet = new Set(monSlots.map(s => s.period_index));
  let run = 0;
  for (let p = 5; p <= 8; p++) {
    if (pSet.has(p)) { run++; if (run > maxRunMonAft) maxRunMonAft = run; }
    else run = 0;
  }

  // Also check all days for Nabila afternoon runs >= 4
  for (const d of days) {
    const dSlots = slotsList.filter(s => s.teacher_name.includes('Nabila') && s.day === d && s.period_index >= 5);
    const set = new Set(dSlots.map(s => s.period_index));
    let r = 0;
    for (let p = 5; p <= 8; p++) {
      if (set.has(p)) {
        r++;
        if (r >= 4) details.push(`${d} afternoon run of ${r}`);
      } else r = 0;
    }
  }

  return { maxRunMonAft, details };
}

console.log('Current Nabila evaluation:', evalNabila(slots));

// Let's find swaps to break Nabila's Monday afternoon run
// Nabila Monday afternoon has:
// P5: JS 3 HAUSA
// P6: JS 2 IRS
// P7: SS 3 IRS
// P8: SS 1 IRS

// Candidate 1: In JS 3 on Monday, can P5 HAUSA swap with an earlier period?
// JS 3 Monday:
// P1: Assembly
// P2: ENG (Kabir)
// P3: ENG (Kabir)
// P4: NV (Maryam)
// P5: HAUSA (Nabila)
// P6: CMP (Sumayya)
// P7: BUS (Kabir)
// P8: PVS (Maryam)
// Can P5 HAUSA swap with P4 NV (Maryam)?
// If P4 is HAUSA (Nabila) and P5 is NV (Maryam):
// Nabila would teach JS 3 HAUSA at P4 (before break)!
// Is Maryam free on Monday at P5?
const maryamMonP5 = slots.filter(r => r.teacher_name.includes('Maryam') && r.day === 'Monday' && r.period_index === 5);
console.log('Is Maryam free on Monday at P5?', maryamMonP5.length === 0, maryamMonP5.map(r => r.subject_name));

// Is Nabila free on Monday at P4?
const nabilaMonP4 = slots.filter(r => r.teacher_name.includes('Nabila') && r.day === 'Monday' && r.period_index === 4);
console.log('Is Nabila free on Monday at P4?', nabilaMonP4.map(r => `${r.class_name} ${r.subject_name}`));
// Nabila already has JS 2 HAUSA at P4 on Monday! So she cannot teach JS 3 at P4.

// What about P6 JS 2 IRS?
// JS 2 Monday:
// P2: BST (Firdaus)
// P3: PVS (Maryam)
// P4: HAUSA (Nabila)
// P5: BUS (Kabir)
// P6: IRS (Nabila)
// P7: NV (Maryam)
// P8: CMP (Sumayya)
// Can P6 JS 2 IRS swap with P3 JS 2 PVS (Maryam)?
// At P3: Maryam is teaching JS 2 PVS.
// Is Nabila free on Monday at P3?
const nabilaMonP3 = slots.filter(r => r.teacher_name.includes('Nabila') && r.day === 'Monday' && r.period_index === 3);
console.log('Is Nabila free on Monday at P3?', nabilaMonP3.length === 0);
// Is Maryam free on Monday at P6?
const maryamMonP6 = slots.filter(r => r.teacher_name.includes('Maryam') && r.day === 'Monday' && r.period_index === 6);
console.log('Is Maryam free on Monday at P6?', maryamMonP6.length === 0, maryamMonP6.map(r => `${r.class_name} ${r.subject_name}`));

// Can P6 JS 2 IRS swap with P2 JS 2 BST (Firdaus)?
const firdausMonP6 = slots.filter(r => r.teacher_name.includes('Nana Firdaus') && r.day === 'Monday' && r.period_index === 6);
console.log('Is Firdaus free on Monday at P6?', firdausMonP6.length === 0, firdausMonP6.map(r => `${r.class_name} ${r.subject_name}`));
const nabilaMonP2 = slots.filter(r => r.teacher_name.includes('Nabila') && r.day === 'Monday' && r.period_index === 2);
console.log('Is Nabila free on Monday at P2?', nabilaMonP2.length === 0);
