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

// Step 1: Eject CMP from Tuesday P5
const js2CmpTueP5 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Tuesday' && s.period_index === 5);
const withoutCmp = rep.slots.filter(s => s !== js2CmpTueP5);
const slotsWithIrsAtTueP5 = [...withoutCmp, {
  class_id: js2.id,
  subject_id: irsUnit.alloc.subject_id,
  teacher_id: irsUnit.alloc.teacher_id,
  day: 'Tuesday',
  period_index: 5,
  is_locked: 0
}];

console.log('Placed IRS at Tuesday P5. Now testing where CMP can go in JS 2:');
const cmpUnit = {
  class_id: js2.id,
  duration: 1,
  isPaired: false,
  alloc: { subject_id: js2CmpTueP5.subject_id, teacher_id: js2CmpTueP5.teacher_id, class_id: js2.id }
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
for (const d of days) {
  const maxP = d === 'Friday' ? 4 : 8;
  const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
  for (let p = startP; p <= maxP; p++) {
    const occ = slotsWithIrsAtTueP5.find(s => s.class_id === js2.id && s.day === d && s.period_index === p);
    if (!occ) {
      // Empty slot!
      const can = gen._canPlaceSlot(cmpUnit, d, p, slotsWithIrsAtTueP5, classMap, teacherMap, subjectMap);
      console.log(`  EMPTY [JS 2] ${d} P${p}: canPlace CMP = ${can}`);
    } else {
      // Occupied slot - can CMP eject occ?
      const withoutOcc = slotsWithIrsAtTueP5.filter(s => s !== occ);
      const can = gen._canPlaceSlot(cmpUnit, d, p, withoutOcc, classMap, teacherMap, subjectMap);
      if (can) {
        console.log(`  CAN EJECT: [${d} P${p}] ${subjectMap[occ.subject_id].code} (${teacherMap[occ.teacher_id].name})`);
      }
    }
  }
}
