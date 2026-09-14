import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

const rows = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

console.log('Finding valid swap pairs or triples to give M. Sumayya rest on Thursday...');

// Let's inspect Thursday slots for all classes
const thuSlots = rows.filter(r => r.day === 'Thursday');

// We want to eliminate Sumayya's 4 consecutive periods on Thursday (currently P5, P6, P7, P8).
// Specifically, Sumayya has:
// SS 2: P5 ENG, P6 ENG
// JS 1: P7 COMP
// JS 3: P8 COMP

// If we can move JS 1 P7 COMP to another day or period, or move SS 2 P5-P6 ENG, or move JS 3 P8 COMP:
// Let's find candidate swaps:
// Candidate type 1: Intra-class swap within JS 1
// In JS 1: can P7 COMP swap with another period in JS 1 on Thursday or another day?
// In JS 1 on Thursday:
// P1: ENG (Kabir)
// P2: ENG (Kabir)
// P3: IRS (Maryam)
// P4: IRS (Maryam)
// P5: HAUSA (Nabila)
// P6: PVS (Maryam)
// P7: COMP (Sumayya)
// P8: STP (Yusuf)

// Can JS 1 COMP swap between Thursday and another day of JS 1?
const js1Comp = rows.filter(r => r.class_name === 'JS 1' && r.subject_name.includes('COMP'));
console.log('JS 1 COMP slots:', js1Comp.map(r => `${r.day} P${r.period_index}`));

const js3Comp = rows.filter(r => r.class_name === 'JS 3' && r.subject_name.includes('COMP'));
console.log('JS 3 COMP slots:', js3Comp.map(r => `${r.day} P${r.period_index}`));

const js2Comp = rows.filter(r => r.class_name === 'JS 2' && r.subject_name.includes('COMP'));
console.log('JS 2 COMP slots:', js2Comp.map(r => `${r.day} P${r.period_index}`));
