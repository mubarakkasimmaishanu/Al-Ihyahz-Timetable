import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

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

console.log('Unplaced count after repair:', rep.unplaced.length);
for (const u of rep.unplaced) {
  console.log(`Unplaced: [${classMap[u.class_id]?.name}] ${subjectMap[(u.alloc||u.allocA).subject_id]?.code} (${teacherMap[(u.alloc||u.allocA).teacher_id]?.name})`);
}

const js3 = classes.find(c => c.name === 'JS 3');
console.log('\n=== JS 3 SCHEDULE (placed: ' + rep.slots.filter(s => s.class_id === js3.id).length + ') ===');
for (const d of gen.days) {
  const dSlots = rep.slots.filter(s => s.class_id === js3.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
  const line = dSlots.map(s => `P${s.period_index}:${subjectMap[s.subject_id]?.code}(${teacherMap[s.teacher_id]?.name})`).join(' | ');
  console.log(`  ${d.padEnd(9)}: ${line}`);
}
