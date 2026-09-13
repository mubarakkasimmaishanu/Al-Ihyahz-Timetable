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

console.log(`Starting: placed=${rep.slots.length}/246, unplaced=${rep.unplaced.length}`);

const js2 = classes.find(c => c.name === 'JS 2');
let slots = rep.slots.map(s => ({ ...s }));

// Step 1: In JS 2, move BUS from Tuesday P8 to Thursday P8
const js2BusTueP8 = slots.find(s => s.class_id === js2.id && s.day === 'Tuesday' && s.period_index === 8);
console.log('Found js2BusTueP8:', !!js2BusTueP8);

if (js2BusTueP8) {
  const withoutBus = slots.filter(s => s !== js2BusTueP8);
  const busUnit = {
    class_id: js2.id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: js2BusTueP8.subject_id, teacher_id: js2BusTueP8.teacher_id, class_id: js2.id }
  };
  const canBusAtThuP8 = gen._canPlaceSlot(busUnit, 'Thursday', 8, withoutBus, classMap, teacherMap, subjectMap);
  console.log('Can JS 2 BUS move to Thursday P8?', canBusAtThuP8);

  if (canBusAtThuP8) {
    js2BusTueP8.day = 'Thursday';
    js2BusTueP8.period_index = 8;

    // Step 2: In JS 2, move CMP from Tuesday P5 to Tuesday P8
    const js2CmpTueP5 = slots.find(s => s.class_id === js2.id && s.day === 'Tuesday' && s.period_index === 5);
    console.log('Found js2CmpTueP5:', !!js2CmpTueP5);

    if (js2CmpTueP5) {
      const withoutCmp = slots.filter(s => s !== js2CmpTueP5);
      const cmpUnit = {
        class_id: js2.id,
        duration: 1,
        isPaired: false,
        alloc: { subject_id: js2CmpTueP5.subject_id, teacher_id: js2CmpTueP5.teacher_id, class_id: js2.id }
      };
      const canCmpAtTueP8 = gen._canPlaceSlot(cmpUnit, 'Tuesday', 8, withoutCmp, classMap, teacherMap, subjectMap);
      console.log('Can JS 2 CMP move to Tuesday P8?', canCmpAtTueP8);

      if (canCmpAtTueP8) {
        js2CmpTueP5.day = 'Tuesday';
        js2CmpTueP5.period_index = 8;

        // Step 3: In JS 2, place unplaced JS 2 IRS at Tuesday P5
        const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);
        const canIrsAtTueP5 = gen._canPlaceSlot(irsUnit, 'Tuesday', 5, slots, classMap, teacherMap, subjectMap);
        console.log('Can JS 2 IRS go to Tuesday P5?', canIrsAtTueP5);

        if (canIrsAtTueP5) {
          slots.push({
            class_id: js2.id,
            subject_id: irsUnit.alloc.subject_id,
            teacher_id: irsUnit.alloc.teacher_id,
            day: 'Tuesday',
            period_index: 5,
            is_locked: 0
          });
          console.log('\n🎉🎉🎉 SUCCESS! JS 2 IRS IS PLACED! Total placed:', slots.length);
        }
      }
    }
  }
}

console.log(`\n================ FINAL TOTAL PLACED: ${slots.length} / 246 ================`);

if (slots.length === 246) {
  const val = validateTimetable(slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('\nVALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
  if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
}
