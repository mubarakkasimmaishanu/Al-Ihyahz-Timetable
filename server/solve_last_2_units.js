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

console.log(`Starting state: placed=${rep.slots.length}/246, unplaced=${rep.unplaced.length}`);

// Let's test the JS 3 chain first:
const js3 = classes.find(c => c.name === 'JS 3');
let slots = rep.slots.map(s => ({ ...s }));

// In JS 3:
// 1. Move BUS from Wed P6 to Wed P8
const js3BusWedP6 = slots.find(s => s.class_id === js3.id && s.day === 'Wednesday' && s.period_index === 6);
// 2. Move NV from Tue P2 to Wed P6
const js3NvTueP2 = slots.find(s => s.class_id === js3.id && s.day === 'Tuesday' && s.period_index === 2);

console.log('js3BusWedP6:', !!js3BusWedP6, 'js3NvTueP2:', !!js3NvTueP2);

if (js3BusWedP6 && js3NvTueP2) {
  // Move BUS to Wed P8
  js3BusWedP6.period_index = 8;
  // Move NV to Wed P6
  js3NvTueP2.day = 'Wednesday';
  js3NvTueP2.period_index = 6;

  // Now check if unplaced JS 3 BUS can go into Tue P2
  const busUnit = rep.unplaced.find(u => u.class_id === js3.id);
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
    console.log('🎉🎉🎉 JS 3 BUS PLACED! Total placed now:', slots.length);
  } else {
    // revert
    js3BusWedP6.period_index = 6;
    js3NvTueP2.day = 'Tuesday';
    js3NvTueP2.period_index = 2;
  }
}

// Now let's test for JS 2:
const js2 = classes.find(c => c.name === 'JS 2');
const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);

console.log('\n--- Searching for a valid chain for JS 2 IRS ---');
// JS 2 has an empty slot at Thursday P8.
// We want to place irsUnit in JS 2.
// Find any occupied slot in JS 2 (say occ) that can move to Thursday P8,
// such that irsUnit can be placed at occ.day, occ.period_index!
const js2Slots = slots.filter(s => s.class_id === js2.id);
let js2Resolved = false;

for (const occ of js2Slots) {
  if (occ.day === 'Thursday' && occ.period_index === 8) continue;

  const occUnit = {
    class_id: js2.id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: occ.subject_id, teacher_id: occ.teacher_id, class_id: js2.id }
  };

  const withoutOcc = slots.filter(s => s !== occ);

  // Can occ move to Thursday P8?
  if (gen._canPlaceSlot(occUnit, 'Thursday', 8, withoutOcc, classMap, teacherMap, subjectMap)) {
    const movedOcc = { ...occ, day: 'Thursday', period_index: 8 };
    const withOccMoved = [...withoutOcc, movedOcc];

    // Can irsUnit go to occ.day, occ.period_index?
    if (gen._canPlaceSlot(irsUnit, occ.day, occ.period_index, withOccMoved, classMap, teacherMap, subjectMap)) {
      console.log(`🎉 Found direct JS 2 move: Move [${subjectMap[occ.subject_id]?.code}] to Thu P8, place IRS at ${occ.day} P${occ.period_index}!`);
      occ.day = 'Thursday';
      occ.period_index = 8;
      slots.push({
        class_id: js2.id,
        subject_id: irsUnit.alloc.subject_id,
        teacher_id: irsUnit.alloc.teacher_id,
        day: occ.day,
        period_index: occ.period_index,
        is_locked: 0
      });
      js2Resolved = true;
      break;
    }
  }
}

if (!js2Resolved) {
  console.log('Checking 2-step chains for JS 2...');
  // Try 2-step chain for JS 2:
  // Move occ1 to Thu P8, move occ2 to occ1's old spot, place IRS at occ2's old spot!
  for (const occ1 of js2Slots) {
    const occUnit1 = {
      class_id: js2.id,
      duration: 1,
      isPaired: false,
      alloc: { subject_id: occ1.subject_id, teacher_id: occ1.teacher_id, class_id: js2.id }
    };
    const withoutOcc1 = slots.filter(s => s !== occ1);

    if (gen._canPlaceSlot(occUnit1, 'Thursday', 8, withoutOcc1, classMap, teacherMap, subjectMap)) {
      const movedOcc1 = { ...occ1, day: 'Thursday', period_index: 8 };
      const with1 = [...withoutOcc1, movedOcc1];

      for (const occ2 of js2Slots) {
        if (occ2 === occ1) continue;
        const occUnit2 = {
          class_id: js2.id,
          duration: 1,
          isPaired: false,
          alloc: { subject_id: occ2.subject_id, teacher_id: occ2.teacher_id, class_id: js2.id }
        };
        const withoutOcc2 = with1.filter(s => s !== occ2);

        if (gen._canPlaceSlot(occUnit2, occ1.day, occ1.period_index, withoutOcc2, classMap, teacherMap, subjectMap)) {
          const movedOcc2 = { ...occ2, day: occ1.day, period_index: occ1.period_index };
          const with2 = [...withoutOcc2, movedOcc2];

          if (gen._canPlaceSlot(irsUnit, occ2.day, occ2.period_index, with2, classMap, teacherMap, subjectMap)) {
            console.log(`🎉 Found 2-step JS 2 chain: Move [${subjectMap[occ1.subject_id]?.code}] to Thu P8, Move [${subjectMap[occ2.subject_id]?.code}] to ${occ1.day} P${occ1.period_index}, Place IRS at ${occ2.day} P${occ2.period_index}!`);
            occ1.day = 'Thursday';
            occ1.period_index = 8;
            occ2.day = occ1.day;
            occ2.period_index = occ1.period_index;
            slots.push({
              class_id: js2.id,
              subject_id: irsUnit.alloc.subject_id,
              teacher_id: irsUnit.alloc.teacher_id,
              day: occ2.day,
              period_index: occ2.period_index,
              is_locked: 0
            });
            js2Resolved = true;
            break;
          }
        }
      }
      if (js2Resolved) break;
    }
  }
}

console.log(`\n================ FINAL TOTAL PLACED: ${slots.length} / 246 ================`);

if (slots.length === 246) {
  const val = validateTimetable(slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('VALIDATION:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
}
