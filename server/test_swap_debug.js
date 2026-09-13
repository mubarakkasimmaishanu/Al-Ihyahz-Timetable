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

// JS 3 BUS unit
const u = res.unplacedUnits.find(unit => classMap[unit.class_id]?.name === 'JS 3' && subjectMap[unit.alloc.subject_id]?.code === 'BUS');
if (u) {
  console.log('Testing 1-step swap for [JS 3] BUS with Friday P3...');
  const e = { day: 'Friday', period: 3 };
  const classSlots = res.slots.filter(s => s.class_id === u.class_id);

  for (const existing of classSlots) {
    const existingUnit = {
      class_id: existing.class_id,
      duration: 1,
      isPaired: false,
      alloc: {
        subject_id: existing.subject_id,
        teacher_id: existing.teacher_id,
        class_id: existing.class_id
      }
    };

    const exSub = subjectMap[existing.subject_id]?.code;
    const exTeach = teacherMap[existing.teacher_id]?.name;

    const withoutExisting = res.slots.filter(s => s !== existing);
    const canMoveExToE = gen._canPlaceSlot(existingUnit, e.day, e.period, withoutExisting, classMap, teacherMap, subjectMap);

    if (canMoveExToE) {
      const withExistingAtE = [...withoutExisting, {
        ...existing,
        day: e.day,
        period_index: e.period
      }];
      const canPlaceUnitAtOld = gen._canPlaceSlot(u, existing.day, existing.period_index, withExistingAtE, classMap, teacherMap, subjectMap);
      console.log(`  Candidate swap with ${exSub}(${exTeach}) at ${existing.day} P${existing.period_index}: canMoveExToFri=${canMoveExToE}, canPlaceBUSToOld=${canPlaceUnitAtOld}`);
    }
  }
}
