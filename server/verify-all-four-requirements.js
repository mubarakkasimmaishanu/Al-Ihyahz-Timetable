import { db } from './db/database.js';
import { validateTimetable } from './engine/validator.js';

console.log('=====================================================');
console.log('  COMPREHENSIVE 4-POINT VERIFICATION AUDIT');
console.log('=====================================================\n');

// 1. M. Mubarak - Data Processing
const mmb = db.prepare("SELECT * FROM teachers WHERE name = 'M. Mubarak'").get();
const mmbDprSlots = db.prepare(`
  SELECT c.name AS class_name, COUNT(*) AS count
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  WHERE ts.teacher_id = ? AND s.code = 'DPR'
  GROUP BY c.name
`).all(mmb.id);
console.log('1. M. Mubarak Data Processing (DPR) Weekly Contacts:');
console.table(mmbDprSlots);

// 2. M. Amina - Agric Science
const mam = db.prepare("SELECT * FROM teachers WHERE name = 'M. Amina'").get();
const mamAgrSlots = db.prepare(`
  SELECT c.name AS class_name, COUNT(*) AS count
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  WHERE ts.teacher_id = ? AND s.code = 'AGR'
  GROUP BY c.name
`).all(mam.id);
console.log('2. M. Amina Agric Science (AGR) Weekly Contacts:');
console.table(mamAgrSlots);

// 3. M. Abba - Civic Education (SS only, 4 contacts)
const mab = db.prepare("SELECT * FROM teachers WHERE name = 'M. Abba'").get();
const mabCivSlots = db.prepare(`
  SELECT c.name AS class_name, c.level AS class_level, COUNT(*) AS count
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  WHERE ts.teacher_id = ? AND s.code = 'CIV'
  GROUP BY c.name
`).all(mab.id);
console.log('3. M. Abba Civic Education (CIV) Weekly Contacts & Class Levels:');
console.table(mabCivSlots);

// 4. M. Shehu - Schedule Breakdown & Period 5 Cap
const msh = db.prepare("SELECT * FROM teachers WHERE name = 'M. Shehu'").get();
const mshSlots = db.prepare(`
  SELECT ts.day, ts.period_index, c.name AS class_name, s.name AS subject_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  WHERE ts.teacher_id = ?
  ORDER BY 
    CASE ts.day 
      WHEN 'Monday' THEN 1 
      WHEN 'Tuesday' THEN 2 
      WHEN 'Wednesday' THEN 3 
      WHEN 'Thursday' THEN 4 
      WHEN 'Friday' THEN 5 
    END, ts.period_index
`).all(msh.id);

console.log(`4. M. Shehu Total Scheduled Slots: ${mshSlots.length} / 22`);
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const fridaySlots = mshSlots.filter(s => s.day === 'Friday');
let mshExceedsP6 = false;
for (const day of days) {
  const dSlots = mshSlots.filter(s => s.day === day);
  const maxP = Math.max(...dSlots.map(s => s.period_index), 0);
  if (maxP > 6) mshExceedsP6 = true;
  const desc = dSlots.map(s => `P${s.period_index}:${s.class_name} ${s.subject_name}`).join(', ');
  console.log(`   ${day.padEnd(10)} (${dSlots.length} periods, Max Period: P${maxP}): ${desc || '100% FREE'}`);
}
console.log(`   M. Shehu Friday Classes Count: ${fridaySlots.length} --> ${fridaySlots.length === 0 ? 'PASSED (100% FREE ON FRIDAY!)' : 'VIOLATION'}`);
console.log(`   M. Shehu Mon-Thu Teaches in P7 or P8? --> ${mshExceedsP6 ? 'YES (VIOLATION)' : 'NO (PASSED: finishes by P6, 0 in P7/P8!)'}`);

// 5. Friday After Break (Periods 5 & 6) Check
const fridayJuniorAfterBreak = db.prepare(`
  SELECT ts.period_index, c.name AS class_name, s.name AS subject_name, t.name AS teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE ts.day = 'Friday' AND ts.period_index >= 5 AND (c.level = 'JS' OR c.name LIKE 'JS%')
`).all();
console.log(`\n5. Friday After Break Junior Classes Check: ${fridayJuniorAfterBreak.length} slots found.`);
if (fridayJuniorAfterBreak.length > 0) {
  console.table(fridayJuniorAfterBreak);
} else {
  console.log('   PASSED: Strictly 0 Junior classes after break on Friday!');
}

// 6. Full Engine Validation
const allClasses = db.prepare('SELECT * FROM classes').all();
const allTeachers = db.prepare('SELECT * FROM teachers').all();
const allSubjects = db.prepare('SELECT * FROM subjects').all();
const allAllocations = db.prepare('SELECT * FROM allocations').all();
const allSlots = db.prepare(`
  SELECT 
    ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index, ts.is_locked,
    c.name AS class_name, s.name AS subject_name, s.code AS subject_code,
    t.name AS teacher_name, t.code AS teacher_code
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
`).all();

const validation = validateTimetable(allSlots, allClasses, allTeachers, allSubjects, allAllocations, {
  regularPeriods: 8,
  fridayPeriods: 6
});

console.log(`\n6. Full Engine Validation Report:`);
console.log(`   Total Slots Placed: ${allSlots.length}`);
console.log(`   Clashes Count: ${validation.clashes?.length || 0}`);
console.log(`   Warnings Count: ${validation.warnings?.length || 0}`);
