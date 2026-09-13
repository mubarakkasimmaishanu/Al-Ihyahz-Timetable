import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

const js2 = classes.find(c => c.name === 'JS 2');
const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);

console.log('Unplaced unit:', classMap[irsUnit.class_id]?.name, subjectMap[irsUnit.alloc.subject_id]?.code, teacherMap[irsUnit.alloc.teacher_id]?.name);

// Find all slots of M. Nabila
const nabila = teachers.find(t => t.name.includes('Nabila'));
console.log('\nM. Nabila all slots across the week:');
for (const d of gen.days) {
  const dSlots = rep.slots.filter(s => s.teacher_id === nabila.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
  console.log(`  ${d.padEnd(9)} (${dSlots.length}p): ${dSlots.map(s => 'P' + s.period_index + ':' + classMap[s.class_id]?.name + ' ' + subjectMap[s.subject_id]?.code).join(' | ')}`);
}

console.log('\nJS 2 all slots across the week:');
for (const d of gen.days) {
  const dSlots = rep.slots.filter(s => s.class_id === js2.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
  console.log(`  ${d.padEnd(9)} (${dSlots.length}p): ${dSlots.map(s => 'P' + s.period_index + ':' + subjectMap[s.subject_id]?.code).join(' | ')}`);
}
