import { db, initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { TimetableGenerator } from './engine/generator.js';

seedDatabase();

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const shehu = teachers.find(t => t.name.includes('Shehu') && t.code === 'MSH');
console.log('Malam Shehu ID:', shehu?.id, shehu?.name, 'Preference:', shehu?.time_preference);

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 5,
  maxRestarts: 30
});

const result = generator.generate(classes, teachers, subjects, allocations);

const shehuSlots = result.slots.filter(s => s.teacher_id === shehu.id);
console.log(`\nMalam Shehu Total Scheduled Slots: ${shehuSlots.length} periods`);

const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
for (const day of days) {
  const daySlots = shehuSlots.filter(s => s.day === day).sort((a, b) => a.period_index - b.period_index);
  const slotStrs = daySlots.map(s => `P${s.period_index}: ${classMap[s.class_id]} ${subjectMap[s.subject_id]}`).join(' | ');
  console.log(`${day.padEnd(10)}: ${slotStrs || 'Free'}`);
}
