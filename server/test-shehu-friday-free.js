import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

console.log('Testing M. Shehu Friday FREE (unavailable_days = ["Friday"])...');

// Set M. Shehu unavailable on Friday in db
db.prepare("UPDATE teachers SET unavailable_days = ? WHERE name = 'M. Shehu'").run(JSON.stringify(['Friday']));

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const shehu = teachers.find(t => t.name === 'M. Shehu');
console.log('Shehu unavailable_days:', shehu.unavailable_days);

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 50
});

const result = generator.generate(classes, teachers, subjects, allocations);
console.log('Solve result success:', result.success, 'restarts:', result.restarts, 'total slots:', result.slots?.length);

if (result.success) {
  const shehuSlots = result.slots.filter(s => s.teacher_id === shehu.id);
  console.log(`\nM. Shehu Placed Slots: ${shehuSlots.length} / 22`);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const d of days) {
    const dSlots = shehuSlots.filter(s => s.day === d).sort((a, b) => a.period_index - b.period_index);
    const desc = dSlots.map(s => `P${s.period_index}`).join(', ');
    console.log(`  ${d.padEnd(9)} (${dSlots.length}): ${desc || 'FREE'}`);
  }
} else {
  console.error('Failed diagnostics:', result.diagnostics);
}
