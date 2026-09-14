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

// Let's analyze M. Sumayya's 4 contacts on Thursday:
// 1. P5: SS 2 ENG
// 2. P6: SS 2 ENG
// 3. P7: JS 1 COMP
// 4. P8: JS 3 COMP

// If any ONE of these 4 contacts is moved away from Thursday afternoon,
// or if P7 is freed (e.g. JS 1 COMP moves to P3, P4, or another day),
// then the consecutive run drops from 4 down to 2! (P5-P6 double, then REST in P7, then P8).
// That is HUGE: 2 periods -> REST -> 1 period!

console.log('--- EXAMINING JS 1 P7 COMP ---');
// Can JS 1 COMP move to P3 or P4 on Thursday?
// In JS 1 Thursday:
// P3 is IRS (Maryam), P4 is IRS (Maryam).
// IRS is a double period for Maryam.
// What about P5 HAUSA (Nabila) or P6 PVS (Maryam)?
// P5 is 11:10, P6 is 11:50, P7 is 12:30, P8 is 13:10.
// If JS 1 P7 COMP swapped with JS 1 P6 PVS (Maryam):
// At P6: Maryam is teaching JS 1 PVS. Is Maryam free at P7?
// Let's check Maryam at P7: Maryam is teaching JS 2 NV at P7. So Maryam cannot do P7.

// What about JS 1 P7 COMP swapping with JS 1 Tuesday P8 COMP or Monday P7 COMP?
// No, those are already COMP!

// What about JS 3 P8 COMP (Sumayya)?
// Can JS 3 P8 COMP swap with another P8 slot of an eligible teacher?
// The other P8 slots on Thursday are:
// JS 1 P8: STP (Yusuf)
// JS 2 P8: NV (Maryam)
// SS 1 P8: CIVIC (Abba)
// SS 2 P8: DATA (Mubarak)
// SS 3 P8: IRS (Nabila)
console.log('Thursday P8 teachers:', ['Sumayya (JS 3)', 'Yusuf (JS 1)', 'Maryam (JS 2)', 'Abba (SS 1)', 'Mubarak (SS 2)', 'Nabila (SS 3)']);

// Can Sumayya swap Thursday P8 with another teacher's P8 slot on another day?
// For example, Sumayya has P8 on:
// Monday P8 (JS 2 COMP)
// Tuesday P8 (JS 1 COMP)
// Thursday P8 (JS 3 COMP)
// What if Sumayya's Thursday P8 was swapped with her having Wednesday P8?
// Wednesday P8 currently:
// JS 1 P8: PVS (Maryam)
// JS 2 P8: BUS (Kabir)
// JS 3 P8: IRS (Yusuf)
// SS 1 P8: AGRIC (Amina)
// SS 2 P8: DATA (Mubarak)
// SS 3 P8: CIVIC (Abba)

// If Sumayya had Wednesday P8 instead of Thursday P8:
// Then on Thursday Sumayya would have NO P8!
// Then on Thursday afternoon, Sumayya would have:
// P5 SS 2 ENG, P6 SS 2 ENG, P7 JS 1 COMP. (That is 3 periods, not 4!).
// And on Thursday P8 she would be 100% FREE!
