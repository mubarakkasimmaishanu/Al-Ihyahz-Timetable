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

console.log('Initial repair unplaced:', rep.unplaced.length);

const js3 = classes.find(c => c.name === 'JS 3');
const js2 = classes.find(c => c.name === 'JS 2');

let slots = [...rep.slots];

// 1. In JS 3: Find NV at Tuesday P2
const js3NvTueP2 = slots.find(s => s.class_id === js3.id && s.day === 'Tuesday' && s.period_index === 2);
if (js3NvTueP2) {
  console.log('Found JS 3 NV at Tue P2:', js3NvTueP2);
  const withoutNv = slots.filter(s => s !== js3NvTueP2);
  const nvUnit = {
    class_id: js3.id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: js3NvTueP2.subject_id, teacher_id: js3NvTueP2.teacher_id, class_id: js3.id }
  };

  const canNvAtWedP8 = gen._canPlaceSlot(nvUnit, 'Wednesday', 8, withoutNv, classMap, teacherMap, subjectMap);
  console.log('Can JS 3 NV go to Wednesday P8?', canNvAtWedP8);

  if (canNvAtWedP8) {
    js3NvTueP2.day = 'Wednesday';
    js3NvTueP2.period_index = 8;

    // Now try placing JS 3 BUS at Tuesday P2
    const busUnit = rep.unplaced.find(u => u.class_id === js3.id);
    if (busUnit) {
      const canBusAtTueP2 = gen._canPlaceSlot(busUnit, 'Tuesday', 2, slots, classMap, teacherMap, subjectMap);
      console.log('Can JS 3 BUS go to Tuesday P2?', canBusAtTueP2);
      if (canBusAtTueP2) {
        slots.push({
          class_id: js3.id,
          subject_id: busUnit.alloc.subject_id,
          teacher_id: busUnit.alloc.teacher_id,
          day: 'Tuesday',
          period_index: 2,
          is_locked: 0
        });
        console.log('>>> Successfully placed JS 3 BUS at Tuesday P2! <<<');
      }
    }
  }
}

// 2. In JS 2: Find STP at Wednesday P8
const js2StpWedP8 = slots.find(s => s.class_id === js2.id && s.day === 'Wednesday' && s.period_index === 8);
if (js2StpWedP8) {
  console.log('\nFound JS 2 STP at Wed P8:', js2StpWedP8);
  const withoutStp = slots.filter(s => s !== js2StpWedP8);
  const stpUnit = {
    class_id: js2.id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: js2StpWedP8.subject_id, teacher_id: js2StpWedP8.teacher_id, class_id: js2.id }
  };

  const canStpAtThuP8 = gen._canPlaceSlot(stpUnit, 'Thursday', 8, withoutStp, classMap, teacherMap, subjectMap);
  console.log('Can JS 2 STP go to Thursday P8?', canStpAtThuP8);

  if (canStpAtThuP8) {
    js2StpWedP8.day = 'Thursday';
    js2StpWedP8.period_index = 8;

    // Now try placing JS 2 IRS at Wednesday P8
    const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);
    if (irsUnit) {
      const canIrsAtWedP8 = gen._canPlaceSlot(irsUnit, 'Wednesday', 8, slots, classMap, teacherMap, subjectMap);
      console.log('Can JS 2 IRS go to Wednesday P8?', canIrsAtWedP8);
      if (canIrsAtWedP8) {
        slots.push({
          class_id: js2.id,
          subject_id: irsUnit.alloc.subject_id,
          teacher_id: irsUnit.alloc.teacher_id,
          day: 'Wednesday',
          period_index: 8,
          is_locked: 0
        });
        console.log('>>> Successfully placed JS 2 IRS at Wednesday P8! <<<');
      }
    }
  }
}

console.log(`\nFinal placed slots: ${slots.length} / 246`);
if (slots.length === 246) {
  const val = validateTimetable(slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('VALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
}
