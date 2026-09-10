import { db } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

seedDatabase();

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('--- Testing Generator with MRV tuning ---');

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 200
});

const start = Date.now();
let successCount = 0;
for (let pass = 1; pass <= 20; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  console.log(`Pass ${pass}: success=${res.success}, slots=${res.slots?.length}, gaps=${res.slots ? res.gaps : 'N/A'}, restarts=${res.restarts}`);
  if (res.success && res.slots.length === 246) {
    const val = validateTimetable(res.slots, classes, teachers, subjects, allocations, {
      fridayPeriods: 6,
      regularPeriods: 8
    });
    console.log(`  Validation: isValid=${val.isValid}, conflicts=${val.conflicts.length}, warnings=${val.warnings.length}`);
    if (val.isValid && res.gaps === 0) {
      console.log('>>> 100% PERFECT CLASH-FREE 0-GAP SOLUTION FOUND! <<<');
      break;
    }
  }
}
console.log(`Finished in ${Date.now() - start}ms`);
