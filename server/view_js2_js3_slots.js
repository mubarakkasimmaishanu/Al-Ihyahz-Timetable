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

for (const clsName of ['JS 2', 'JS 3']) {
  const cls = classes.find(c => c.name === clsName);
  console.log(`\n=================== ${clsName} FULL SCHEDULE ===================`);
  for (const d of gen.days) {
    const dSlots = rep.slots.filter(sl => sl.class_id === cls.id && sl.day === d).sort((a,b) => a.period_index - b.period_index);
    const line = dSlots.map(sl => `P${sl.period_index}:${subjectMap[sl.subject_id]?.code}(${teacherMap[sl.teacher_id]?.name})`).join(' | ');
    console.log(`  ${d.padEnd(9)}: ${line}`);
  }
}
