import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

console.log('Testing Friday 4 Periods with updated generator heuristics...');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const rawAllocations = db.prepare('SELECT * FROM allocations').all();

// Set DPR to 3 periods per week in SS 1, SS 2, SS 3
const dprSub = subjects.find(s => s.code === 'DPR');
const allocations = rawAllocations.map(a => {
  if (a.subject_id === dprSub.id) {
    return { ...a, periods_per_week: 3, allow_double: 0 };
  }
  return a;
});

const totalAllocPeriods = allocations.reduce((sum, a) => sum + a.periods_per_week, 0);
console.log('Total weekly allocations across all teachers:', totalAllocPeriods);

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 4,
  maxRestarts: 100
});

const result = generator.generate(classes, teachers, subjects, allocations);
console.log('Solve result success:', result.success, 'restarts:', result.restarts, 'total slots:', result.slots?.length);
if (result.success) {
  console.log('\nSUCCESS! 100% Conflict-free timetable generated!');
  const fridaySlots = result.slots.filter(s => s.day === 'Friday');
  console.log('Total Friday slots placed:', fridaySlots.length);
  const fridayAfterBreak = fridaySlots.filter(s => s.period_index > 4);
  console.log('Friday after break slots (> P4):', fridayAfterBreak.length);

  console.log('\n--- Daily Class Period Counts ---');
  for (const c of classes) {
    const counts = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => {
      const cnt = result.slots.filter(s => s.class_id === c.id && s.day === d).length;
      return `${d.slice(0,3)}: ${cnt}`;
    });
    console.log(`  ${c.name.padEnd(6)} -> ${counts.join(' | ')}`);
  }
} else {
  console.log('Diagnostics:', result.diagnostics);
}
