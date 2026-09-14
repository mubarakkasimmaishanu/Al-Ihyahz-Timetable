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

console.log('--- SIMULATING SWAP OF SS 2 WED P1-P2 MATHS WITH THU P5-P6 ENG ---');

// What if SS 2 Wed P5 ENG was swapped with Thu P5-P6, or what if Wed P1-P2 MATHS swaps with Thu P5-P6 ENG?
// If Wed P1-P2 MATHS swaps with Thu P5-P6 ENG:
// SS 2 on Wednesday would have ENG at P1, P2, and P5. That's 3 ENG in one day, which violates the 1-double-or-single per day rule.
// BUT what if SS 2 Wed P5 ENG swaps with Thu P5 or P6?
// Let's test swapping SS 2 Thu P5 ENG with SS 2 Wed P1 MATHS:
// Then:
// Thu SS 2 has P5 MATHS, P6 ENG. (Wait, Maths in P5 is fine, but Maths/Eng double split).

// What about other subjects in SS 2 on Thursday?
// SS 2 on Thursday:
// P1-P2: GOVT/PHY
// P3-P4: CHEM/ECON
// P5-P6: ENG
// P7-P8: DATA (Mubarak)

// What about SS 1 on Thursday?
// P1-P2: ENG (Sumayya)
// P3: IRS (Nabila)
// P4: DATA (Mubarak)
// P5: AGRIC (Amina)
// P6: GOVT/PHY
// P7: BIO/LIT
// P8: CIVIC (Abba)

// What if SS 1 P1-P2 ENG (Sumayya) and SS 2 P5-P6 ENG (Sumayya) are adjusted?
// On Thursday, Sumayya teaches SS 1 in P1-P2, then SS 2 in P5-P6, then JS 1 in P7, then JS 3 in P8.
// Why can't SS 2 ENG be in P3-P4 on Thursday?
// In SS 2, P3-P4 is CHEM/ECON. Firdaus & Abba.
// What if in SS 2, P3-P4 CHEM/ECON and P5-P6 ENG are swapped?
// Let's check:
// In SS 2:
// Can CHEM/ECON be in P5-P6 on Thursday?
// Let's check Nana Firdaus on Thursday P5-P6:
const firdausThuP5P6 = rows.filter(r => r.teacher_name.includes('Nana Firdaus') && r.day === 'Thursday' && (r.period_index === 5 || r.period_index === 6));
console.log('Nana Firdaus Thursday P5-P6:', firdausThuP5P6.map(r => `${r.class_name} ${r.subject_name}`));

// And Abba on Thursday P5-P6:
const abbaThuP5P6 = rows.filter(r => r.teacher_name.includes('Abba') && r.day === 'Thursday' && (r.period_index === 5 || r.period_index === 6));
console.log('Abba Thursday P5-P6:', abbaThuP5P6.map(r => `${r.class_name} ${r.subject_name}`));
