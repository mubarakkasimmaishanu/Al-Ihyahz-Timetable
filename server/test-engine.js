import { db, initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

console.log('--- Initializing Test Run ---');
seedDatabase();

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log(`Loaded ${classes.length} classes, ${teachers.length} teachers, ${subjects.length} subjects, ${allocations.length} allocations.`);

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 5,
  maxRestarts: 30
});

console.time('Generation Time');
const result = generator.generate(classes, teachers, subjects, allocations);
console.timeEnd('Generation Time');

console.log(`Generation Success: ${result.success}`);
console.log(`Total slots placed: ${result.slots.length}`);

const validation = validateTimetable(result.slots, classes, teachers, subjects, allocations, {
  fridayPeriods: 5,
  regularPeriods: 8
});

console.log('\n--- Validation Results ---');
console.log(`Valid: ${validation.isValid}`);
console.log(`Conflict count: ${validation.conflictCount}`);
console.log(`Warning count: ${validation.warningCount}`);
console.log(`Summary: ${validation.summary}`);

if (validation.conflicts.length > 0) {
  console.log('\nConflicts:');
  console.log(validation.conflicts);
}
