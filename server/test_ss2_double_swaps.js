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

const ss2Slots = slots.filter(s => s.class_name === 'SS 2');
const ss2MonEng1 = ss2Slots.find(s => s.day === 'Monday' && s.period_index === 2 && s.subject_name.includes('ENG'));
const ss2MonEng2 = ss2Slots.find(s => s.day === 'Monday' && s.period_index === 3 && s.subject_name.includes('ENG'));

console.log('Testing swaps for SS 2 Monday P2-P3 ENG double:');
// Check if P2-P3 can swap with another double period in SS 2:
// Other doubles in SS 2:
// Mon P5-P6 CIVIC (Abba)
// Mon P7-P8 AGRIC (Amina)
// Tue P1-P2 BIO/LIT
// Tue P3-P4 MATHS (Yusuf)
// Wed P1-P2 MATHS (Yusuf)
// Thu P1-P2 GOVT/PHY
// Thu P3-P4 CHEM/ECON
// Thu P7-P8 DATA (Mubarak)

// Can Mon P2-P3 ENG swap with Mon P5-P6 CIVIC (Abba)?
// If Mon P2-P3 is CIVIC (Abba) and Mon P5-P6 is ENG (Sumayya):
// At P2-P3: Abba teaches CIVIC. Is Abba free on Monday at P2-P3?
const abbaMonP2P3 = slots.filter(r => r.teacher_name.includes('Abba') && r.day === 'Monday' && (r.period_index === 2 || r.period_index === 3));
console.log('Is Abba free on Monday P2-P3?', abbaMonP2P3.length === 0, abbaMonP2P3.map(r => r.subject_name));

// Is Sumayya free on Monday P5-P6?
const sumayyaMonP5P6 = slots.filter(r => r.teacher_name.includes('Sumayya') && r.day === 'Monday' && (r.period_index === 5 || r.period_index === 6));
console.log('Is Sumayya free on Monday P5-P6?', sumayyaMonP5P6.map(r => `${r.class_name} ${r.subject_name}`));
