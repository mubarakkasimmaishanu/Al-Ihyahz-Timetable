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

// Let's test a 2-step or 3-step chain that moves JS 1 COMP from Thursday P7:
// Suppose JS 1 Thursday has:
// P1-P2: Zainab ENG
// P3-P4: Maryam IRS
// P5: Nabila HAUSA
// P6: Maryam PVS
// P7: Sumayya COMP
// P8: Yusuf STP

// Where is Sumayya free on Thursday?
// Sumayya is free on Thursday at P3 and P4!
// Can JS 1 COMP be in P3 or P4 on Thursday?
// If JS 1 COMP is at P3 or P4, who is currently at P3 and P4 in JS 1?
// P3 and P4 in JS 1 is IRS (Maryam) double.
// If Maryam's IRS double moves from P3-P4 to P6-P7:
// Then JS 1 has:
// P1-P2: Zainab ENG
// P3: Sumayya COMP
// P4: Maryam PVS (or Nabila HAUSA)
// P5: Nabila HAUSA
// P6-P7: Maryam IRS double!
// P8: Yusuf STP

// Let's check if Maryam is free at P7 on Thursday!
// Where is Maryam on Thursday?
const maryamThu = rows.filter(r => r.teacher_name.includes('Maryam') && r.day === 'Thursday');
console.log('Maryam Thursday slots:');
maryamThu.forEach(r => console.log(`  P${r.period_index} in ${r.class_name} (${r.subject_name})`));
