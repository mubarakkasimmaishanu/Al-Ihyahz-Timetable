import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });
for (let r = 0; r < 30; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
  if (rep.unplacedCount <= 2 && rep.unplacedCount > 0) {
    console.log('--- Restart', r, 'Repaired unplaced count:', rep.unplacedCount);
    for (const u of rep.unplaced) {
      const isJunior = classMap[u.class_id]?.level === 'JS';
      const emptySlots = [];
      for (const d of gen.days) {
        const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
        const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
        for (let p = startP; p <= maxP; p++) {
          if (!rep.slots.some(s => s.class_id === u.class_id && s.day === d && s.period_index === p)) {
            emptySlots.push({ day: d, period: p });
          }
        }
      }
      console.log('Unit:', u.unitId, 'Class:', classMap[u.class_id].name, 'Empty:', emptySlots);
      
      const cSlots = rep.slots.filter(s => s.class_id === u.class_id);
      for (const e of emptySlots) {
        console.log(`Checking swaps into empty slot ${e.day} P${e.period}...`);
        for (const ex of cSlots) {
          const sub = subjectMap[ex.subject_id];
          const tch = teacherMap[ex.teacher_id];
          const exUnit = { class_id: u.class_id, duration: 1, isPaired: false, alloc: { subject_id: ex.subject_id, teacher_id: ex.teacher_id, class_id: u.class_id } };
          const withoutEx = rep.slots.filter(s => s !== ex);
          const canMoveEx = gen._canPlaceSlot(exUnit, e.day, e.period, withoutEx, classMap, teacherMap, subjectMap);
          if (canMoveEx) {
            const withExAtE = [...withoutEx, { ...ex, day: e.day, period_index: e.period }];
            const canPlaceU = gen._canPlaceSlot(u, ex.day, ex.period_index, withExAtE, classMap, teacherMap, subjectMap);
            console.log(`  CanMoveEx [${sub.code}] (${tch.name}) from ${ex.day} P${ex.period_index} to ${e.day} P${e.period}: true | CanPlaceUnitAtOldSpot: ${canPlaceU}`);
          }
        }
      }
    }
    break;
  }
}
