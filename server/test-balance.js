import { db } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

seedDatabase();

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 5,
  maxRestarts: 30
});

const result = generator.generate(classes, teachers, subjects, allocations);

console.log('--- GENERATION RESULT ---');
console.log('Success:', result.success);
console.log('Total slots placed:', result.slots.length);

for (const t of teachers) {
  const tSlots = result.slots.filter(s => s.teacher_id === t.id);
  const before = tSlots.filter(s => s.period_index <= 4);
  const after = tSlots.filter(s => s.period_index > 4);
  console.log(`\nTeacher: ${t.name} (${t.code}) | Preference: ${t.time_preference}`);
  console.log(`  Total: ${tSlots.length} periods`);
  console.log(`  Before Break (P1-P4): ${before.length} periods (${Math.round(before.length / tSlots.length * 100)}%)`);
  console.log(`  After Break  (P5-P8): ${after.length} periods (${Math.round(after.length / tSlots.length * 100)}%)`);
}

for (const c of classes) {
  const cSlots = result.slots.filter(s => s.class_id === c.id);
  const before = cSlots.filter(s => s.period_index <= 4);
  const after = cSlots.filter(s => s.period_index > 4);
  console.log(`\nClass: ${c.name} - Total: ${cSlots.length} periods`);
  console.log(`  Before Break: ${before.length} | After Break: ${after.length}`);
}

const validation = validateTimetable(result.slots, classes, teachers, subjects, allocations, {
  fridayPeriods: 5,
  regularPeriods: 8
});

console.log('\n--- VALIDATION ---');
console.log('Valid:', validation.isValid);
console.log('Clashes:', validation.conflictCount);
