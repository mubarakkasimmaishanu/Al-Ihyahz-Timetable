import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
console.log('Placed:', res.slots.length, 'Unplaced:', res.unplacedCount);

// For each unplaced unit, check every day and period and see which rule rejected it
for (const unit of res.unplacedUnits) {
  const cls = classMap[unit.class_id];
  const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
  const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
  const tNames = tIds.map(id => teacherMap[id].name).join(' & ');
  const sCodes = sIds.map(id => subjectMap[id].code).join(' & ');

  console.log(`\nUnplaced Unit ${unit.unitId} (${cls.name} ${sCodes} - ${tNames}, dur=${unit.duration}):`);

  const reasons = {};
  for (const day of gen.days) {
    const maxP = day === 'Friday' ? 6 : 8;
    for (let p = 1; p <= maxP; p++) {
      if (unit.duration === 2 && p >= maxP) continue;
      const p2 = unit.duration === 2 ? p + 1 : null;

      // Check each condition manually
      if ((day === 'Monday' || day === 'Friday') && (p === 1 || p2 === 1)) {
        reasons['Assembly P1'] = (reasons['Assembly P1'] || 0) + 1;
        continue;
      }
      if (day !== 'Friday' && unit.duration === 2 && p === 4) {
        reasons['Break span P4'] = (reasons['Break span P4'] || 0) + 1;
        continue;
      }
      if (day === 'Friday' && unit.duration === 2) {
        reasons['Friday double'] = (reasons['Friday double'] || 0) + 1;
        continue;
      }
      if (day === 'Friday' && (cls.name.startsWith('JS')) && (p > 4 || (p2 && p2 > 4))) {
        reasons['Friday JS > P4'] = (reasons['Friday JS > P4'] || 0) + 1;
        continue;
      }
      // Class busy
      const cBusy = res.slots.some(s => s.class_id === unit.class_id && s.day === day && (s.period_index === p || s.period_index === p2));
      if (cBusy) {
        reasons['Class busy'] = (reasons['Class busy'] || 0) + 1;
        continue;
      }
      // Teacher busy
      const tBusy = res.slots.some(s => tIds.includes(s.teacher_id) && s.day === day && (s.period_index === p || s.period_index === p2));
      if (tBusy) {
        reasons['Teacher busy'] = (reasons['Teacher busy'] || 0) + 1;
        continue;
      }

      // CanPlace check
      const can = gen._canPlaceSlot(unit, day, p, res.slots, classMap, teacherMap, subjectMap);
      if (!can) {
        reasons['_canPlaceSlot rejected'] = (reasons['_canPlaceSlot rejected'] || 0) + 1;
      } else {
        reasons['VALID SLOT AVAILABLE'] = (reasons['VALID SLOT AVAILABLE'] || 0) + 1;
      }
    }
  }
  console.log('  Rejection breakdown:', reasons);
}
