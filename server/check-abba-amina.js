import { db } from './db/database.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const slots = db.prepare(`
  SELECT ts.day, ts.period_index, ts.class_id, c.name as class_name, 
         ts.subject_id, s.name as subject_name, s.code as subject_code,
         ts.teacher_id, t.name as teacher_name, t.code as teacher_code
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  ORDER BY CASE ts.day
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
  END, ts.period_index ASC
`).all();

console.log('--- TOTAL SYSTEM STATS ---');
console.log(`Classes: ${classes.length}, Teachers: ${teachers.length}, Subjects: ${subjects.length}, Allocations: ${allocations.length}`);
console.log(`Total Timetable Slots: ${slots.length}`);

// Validation
const valResult = validateTimetable(slots, classes, teachers, subjects, allocations);
console.log('\n--- SYSTEM VALIDATION ---');
console.log(`Valid: ${valResult.isValid}, Conflicts: ${valResult.conflictCount}, Warnings: ${valResult.warningCount}`);
if (valResult.conflicts.length > 0) {
  console.error('Conflicts:', valResult.conflicts);
}
if (valResult.warnings.length > 0) {
  console.warn('Warnings:', valResult.warnings);
}

// 1. M. Abba Inspection
console.log('\n========================================');
console.log('TEACHER: M. Abba (MAB)');
console.log('========================================');
const abbaSlots = slots.filter(s => s.teacher_name === 'M. Abba');
console.log(`Total Slots: ${abbaSlots.length} / 21`);

const abbaDays = {};
let abbaMorning = 0;
let abbaAfternoon = 0;
for (const s of abbaSlots) {
  abbaDays[s.day] = (abbaDays[s.day] || 0) + 1;
  if (s.period_index <= 4) abbaMorning++;
  else abbaAfternoon++;
}
console.log('Daily Spread:', abbaDays);
console.log(`Before Break (P1-P4): ${abbaMorning}, After Break (P5-P8): ${abbaAfternoon}`);
console.table(abbaSlots.map(s => ({
  day: s.day,
  period: s.period_index,
  class: s.class_name,
  subject: s.subject_name
})));

// 2. M. Amina Inspection
console.log('\n========================================');
console.log('TEACHER: M. Amina (MAM)');
console.log('========================================');
const aminaSlots = slots.filter(s => s.teacher_name === 'M. Amina');
console.log(`Total Slots: ${aminaSlots.length} / 24`);

const aminaDays = {};
let aminaMorning = 0;
let aminaAfternoon = 0;
for (const s of aminaSlots) {
  aminaDays[s.day] = (aminaDays[s.day] || 0) + 1;
  if (s.period_index <= 4) aminaMorning++;
  else aminaAfternoon++;
}
console.log('Daily Spread:', aminaDays);
console.log(`Before Break (P1-P4): ${aminaMorning}, After Break (P5-P8): ${aminaAfternoon}`);
console.table(aminaSlots.map(s => ({
  day: s.day,
  period: s.period_index,
  class: s.class_name,
  subject: s.subject_name
})));

// 3. Paired Economics ↔ Biology Check
console.log('\n========================================');
console.log('PAIRED ELECTIVE: Economics ↔ Biology Alignment');
console.log('========================================');
for (const cls of ['SS 1', 'SS 2', 'SS 3']) {
  console.log(`\nClass ${cls}:`);
  const cEco = abbaSlots.filter(s => s.class_name === cls && s.subject_code === 'ECO');
  const cBio = aminaSlots.filter(s => s.class_name === cls && s.subject_code === 'BIO');
  console.log(`  ECO count: ${cEco.length}, BIO count: ${cBio.length}`);

  let aligned = 0;
  for (const e of cEco) {
    const match = cBio.find(b => b.day === e.day && b.period_index === e.period_index);
    if (match) {
      aligned++;
      console.log(`  ✓ ${e.day} Period ${e.period_index}: ECO (M. Abba) <---> BIO (M. Amina)`);
    } else {
      console.error(`  ✗ MISMATCH on ${e.day} Period ${e.period_index}: ECO has no matching BIO!`);
    }
  }
  console.log(`  Alignment status: ${aligned}/4 slots perfectly synchronized.`);
}
