import { db } from './db/database.js';
import { validateTimetable } from './engine/validator.js';

console.log('=== Checking M. Nabila Allocations & Timetable Slots ===');

const teacher = db.prepare("SELECT * FROM teachers WHERE name = 'M. Nabila'").get();
console.log('Teacher Record:', teacher);

if (!teacher) {
  console.error('Teacher M. Nabila not found!');
  process.exit(1);
}

const allocations = db.prepare(`
  SELECT a.id, c.name AS class_name, s.name AS subject_name, s.code AS subject_code, a.periods_per_week
  FROM allocations a
  JOIN classes c ON c.id = a.class_id
  JOIN subjects s ON s.id = a.subject_id
  WHERE a.teacher_id = ?
`).all(teacher.id);

console.log('\n--- Allocations ---');
console.table(allocations);

const slots = db.prepare(`
  SELECT ts.id, ts.day, ts.period_index, c.name AS class_name, s.name AS subject_name, s.code AS subject_code
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
`).all(teacher.id);

console.log(`\n--- Placed Slots (Total: ${slots.length} / 21) ---`);
console.table(slots);

// Day distribution & Before/After break
const dayCounts = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
let beforeBreak = 0;
let afterBreak = 0;

for (const s of slots) {
  dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
  if (s.period_index <= 4) {
    beforeBreak++;
  } else {
    afterBreak++;
  }
}

console.log('\n--- Day Distribution ---', dayCounts);
console.log(`--- Balance: Before Break (P1-P4) = ${beforeBreak}, After Break (P5-P8) = ${afterBreak} ---`);

// Run full validator
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

console.log('\n=== Full Engine Validation ===');
console.log('Clashes:', validation.clashes?.length || 0);
console.log('Warnings:', validation.warnings?.length || 0);
if (validation.clashes && validation.clashes.length > 0) {
  console.log('Clashes detail:', validation.clashes);
}
