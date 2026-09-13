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
const irsUnit = rep.unplaced[0];

// Step 1: In JS 2, move STP from Wednesday P8 to Thursday P8
const stpWedP8 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Wednesday' && s.period_index === 8);
const withoutStp = rep.slots.filter(s => s !== stpWedP8);
const slots1 = [...withoutStp, { ...stpWedP8, day: 'Thursday', period_index: 8 }];

// Step 2: In JS 2, place IRS at Tuesday P5 (ejecting CMP)
const cmpTueP5 = slots1.find(s => s.class_id === js2.id && s.day === 'Tuesday' && s.period_index === 5);
const withoutCmp = slots1.filter(s => s !== cmpTueP5);
const slots2 = [...withoutCmp, {
  class_id: js2.id,
  subject_id: irsUnit.alloc.subject_id,
  teacher_id: irsUnit.alloc.teacher_id,
  day: 'Tuesday',
  period_index: 5,
  is_locked: 0
}];

// Step 3: Can CMP go to Wednesday P8?
const cmpUnit = {
  class_id: js2.id,
  duration: 1,
  isPaired: false,
  alloc: { subject_id: cmpTueP5.subject_id, teacher_id: cmpTueP5.teacher_id, class_id: js2.id }
};

const canCmpWedP8 = gen._canPlaceSlot(cmpUnit, 'Wednesday', 8, slots2, classMap, teacherMap, subjectMap);
console.log('Can CMP go to Wednesday P8?', canCmpWedP8);

if (!canCmpWedP8) {
  // Why not?
  const tId = cmpUnit.alloc.teacher_id;
  const t = teacherMap[tId];
  const tDaySlots = slots2.filter(s => s.teacher_id === tId && s.day === 'Wednesday');
  console.log('Sumayya Wednesday slots count:', tDaySlots.length);
  console.log('Sumayya Wednesday slots:', tDaySlots.map(s => s.period_index));
  const tP8Count = slots2.filter(s => s.teacher_id === tId && s.period_index === 8).length;
  console.log('Sumayya P8 count:', tP8Count);
}
