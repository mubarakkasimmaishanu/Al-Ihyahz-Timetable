import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('Testing TimetableGenerator from generator-balanced.js...');

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 100
});

const t0 = Date.now();
const res = gen.generate(classes, teachers, subjects, allocations);
const elapsed = Date.now() - t0;

console.log(`Generation completed in ${elapsed}ms. Success: ${res.success}, Total Slots: ${res.slots?.length}`);

if (!res.success) {
  console.log('Diagnostics:', res.diagnostics);
  process.exit(1);
}

// Audit Period 8
console.log('\n=== PERIOD 8 DISTRIBUTION AUDIT ===');
const p8Slots = res.slots.filter(s => s.period_index === 8);
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

console.log(`Total Period 8 slots: ${p8Slots.length}`);
console.table(p8Slots.map(s => ({
  class: classMap[s.class_id]?.name,
  day: s.day,
  subject: subjectMap[s.subject_id]?.name,
  code: subjectMap[s.subject_id]?.code,
  teacher: teacherMap[s.teacher_id]?.name
})));

// Check teacher counts
console.log('\n=== TEACHER WORKLOAD & PERIOD 8 COUNTS ===');
for (const t of teachers) {
  const tSlots = res.slots.filter(s => s.teacher_id === t.id);
  const tP8 = tSlots.filter(s => s.period_index === 8).length;
  const p14 = tSlots.filter(s => s.period_index <= 4).length;
  const p58 = tSlots.filter(s => s.period_index >= 5).length;
  
  // check max consecutive
  let maxConsec = 0;
  for (const d of gen.days) {
    const dSlots = tSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
    let c = 0, lastP = -99;
    for (const s of dSlots) {
      if (s.period_index === lastP + 1) c++;
      else c = 1;
      lastP = s.period_index;
      if (c > maxConsec) maxConsec = c;
    }
  }

  console.log(`Teacher: ${t.name.padEnd(16)} | Total: ${tSlots.length.toString().padStart(2)} | P1-4: ${p14.toString().padStart(2)} | P5-8: ${p58.toString().padStart(2)} | P8: ${tP8} | MaxConsec: ${maxConsec}`);
}

// Check validation
const val = validateTimetable(res.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
console.log('\n=== VALIDATOR REPORT ===');
console.log(`Is Valid: ${val.isValid}`);
console.log(`Conflicts: ${val.conflicts.length}`);
console.log(`Warnings: ${val.warnings.length}`);
if (val.conflicts.length > 0) console.log(val.conflicts);
