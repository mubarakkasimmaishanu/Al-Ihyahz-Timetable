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

const js1 = classes.find(c => c.name === 'JS 1');
const js1Hausa = rep.slots.find(s => s.class_id === js1.id && s.day === 'Thursday' && s.period_index === 8);
console.log('js1Hausa:', js1Hausa ? subjectMap[js1Hausa.subject_id].code : 'none');

// Test each slot in JS 1
const js1Slots = rep.slots.filter(s => s.class_id === js1.id && s !== js1Hausa);
for (const s of js1Slots) {
  const withoutBoth = rep.slots.filter(x => x !== js1Hausa && x !== s);
  const hUnit = { class_id: js1.id, duration: 1, isPaired: false, alloc: { subject_id: js1Hausa.subject_id, teacher_id: js1Hausa.teacher_id, class_id: js1.id } };
  const sUnit = { class_id: js1.id, duration: 1, isPaired: false, alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: js1.id } };

  const canHAtS = gen._canPlaceSlot(hUnit, s.day, s.period_index, withoutBoth, classMap, teacherMap, subjectMap);
  if (canHAtS) {
    const withHAtS = [...withoutBoth, { ...js1Hausa, day: s.day, period_index: s.period_index }];
    const canSAtP8 = gen._canPlaceSlot(sUnit, 'Thursday', 8, withHAtS, classMap, teacherMap, subjectMap);
    console.log(`  Can swap with [${s.day} P${s.period_index}] ${subjectMap[s.subject_id].code} (${teacherMap[s.teacher_id].name}): canHAtS=${canHAtS}, canSAtP8=${canSAtP8}`);
  }
}
