import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
const js2 = classes.find(c => c.name === 'JS 2');

console.log('Slots in JS 2 that can directly move to Thursday P8:');
const js2Slots = rep.slots.filter(s => s.class_id === js2.id);
for (const s of js2Slots) {
  const sub = subjectMap[s.subject_id].code;
  const t = teacherMap[s.teacher_id].name;
  const withoutS = rep.slots.filter(x => x !== s);
  const u = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: js2.id } };
  const can = gen._canPlaceSlot(u, 'Thursday', 8, withoutS, classMap, teacherMap, subjectMap);
  if (can) {
    console.log(`  CAN MOVE: [${s.day} P${s.period_index}] ${sub} (${t}) -> Thursday P8`);
  }
}

console.log('\nUnplaced units:');
for (const u of rep.unplaced) {
  const sub = subjectMap[u.alloc?.subject_id]?.code;
  const t = teacherMap[u.alloc?.teacher_id]?.name;
  console.log(`  Unplaced: [Class ${classMap[u.class_id]?.name}] ${sub} (${t})`);
}
