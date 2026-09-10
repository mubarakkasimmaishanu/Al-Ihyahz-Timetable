import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const rawAllocations = db.prepare('SELECT * FROM allocations').all();

const dprSub = subjects.find(s => s.code === 'DPR');
const allocations = rawAllocations.map(a => {
  if (a.subject_id === dprSub.id) {
    return { ...a, periods_per_week: 3, allow_double: 0 };
  }
  return a;
});

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 4,
  maxRestarts: 10
});

const result = generator.generate(classes, teachers, subjects, allocations);
console.log('Solve success:', result.success, 'slots:', result.slots?.length);
if (!result.success) {
  console.log('Diagnostics:', result.diagnostics);
  
  // Find which class and subject was missed
  const classSlotCounts = {};
  for (const s of result.slots) {
    classSlotCounts[s.class_id] = (classSlotCounts[s.class_id] || 0) + 1;
  }
  for (const c of classes) {
    const classAllocs = allocations.filter(a => a.class_id === c.id);
    const expected = classAllocs.reduce((sum, a) => sum + a.periods_per_week, 0);
    const actual = classSlotCounts[c.id] || 0;
    console.log(`Class ${c.name}: expected ${expected}, actual ${actual}, diff: ${expected - actual}`);
  }
}
