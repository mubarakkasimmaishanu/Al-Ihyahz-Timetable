import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 200 });

function tryRepairWithSwap(slots, unplacedUnits) {
  if (unplacedUnits.length !== 1) return null;
  const unplacedUnit = unplacedUnits[0];
  const targetClassId = unplacedUnit.class_id;

  // Find empty slots
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const empties = [];
  for (const cls of classes) {
    const isJunior = cls.name?.startsWith('JS') || cls.level === 'JS';
    for (const d of days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        if (!slots.some(s => s.class_id === cls.id && s.day === d && s.period_index === p)) {
          empties.push({ class_id: cls.id, day: d, period: p });
        }
      }
    }
  }

  // Group single slots by class
  const singleSlots = slots.filter(s => !s.is_locked);
  const slotsByClass = {};
  for (const s of singleSlots) {
    if (!slotsByClass[s.class_id]) slotsByClass[s.class_id] = [];
    slotsByClass[s.class_id].push(s);
  }

  for (const [clsIdStr, cSlots] of Object.entries(slotsByClass)) {
    const clsId = Number(clsIdStr);
    const cls = classMap[clsId];

    for (let i = 0; i < cSlots.length; i++) {
      for (let j = i + 1; j < cSlots.length; j++) {
        const sA = cSlots[i];
        const sB = cSlots[j];
        if (sA.day === sB.day && sA.period_index === sB.period_index) continue;
        if (sA.subject_id === sB.subject_id && sA.teacher_id === sB.teacher_id) continue;

        const withoutBoth = slots.filter(x => x !== sA && x !== sB);
        const unitA = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sA.subject_id, teacher_id: sA.teacher_id, class_id: clsId } };
        const unitB = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sB.subject_id, teacher_id: sB.teacher_id, class_id: clsId } };

        if (gen._canPlaceSlot(unitA, sB.day, sB.period_index, withoutBoth, classMap, teacherMap, subjectMap)) {
          const withAAtB = [...withoutBoth, { ...sA, day: sB.day, period_index: sB.period_index }];
          if (gen._canPlaceSlot(unitB, sA.day, sA.period_index, withAAtB, classMap, teacherMap, subjectMap)) {
            const swappedSlots = [...withAAtB, { ...sB, day: sA.day, period_index: sA.period_index }];

            for (const e of empties) {
              if (e.class_id === targetClassId && gen._canPlaceSlot(unplacedUnit, e.day, e.period, swappedSlots, classMap, teacherMap, subjectMap)) {
                return [...swappedSlots, {
                  class_id: targetClassId,
                  subject_id: unplacedUnit.alloc.subject_id,
                  teacher_id: unplacedUnit.alloc.teacher_id,
                  day: e.day,
                  period_index: e.period,
                  is_locked: 0
                }];
              }
            }

            for (const e of empties) {
              if (e.class_id === targetClassId) {
                for (const sTarget of swappedSlots.filter(s => s.class_id === targetClassId)) {
                  const withoutSTarget = swappedSlots.filter(x => x !== sTarget);
                  const uTarget = { class_id: targetClassId, duration: 1, isPaired: false, alloc: { subject_id: sTarget.subject_id, teacher_id: sTarget.teacher_id, class_id: targetClassId } };
                  if (gen._canPlaceSlot(uTarget, e.day, e.period, withoutSTarget, classMap, teacherMap, subjectMap)) {
                    const withSTargetAtE = [...withoutSTarget, { ...sTarget, day: e.day, period_index: e.period }];
                    if (gen._canPlaceSlot(unplacedUnit, sTarget.day, sTarget.period_index, withSTargetAtE, classMap, teacherMap, subjectMap)) {
                      return [...withSTargetAtE, {
                        class_id: targetClassId,
                        subject_id: unplacedUnit.alloc.subject_id,
                        teacher_id: unplacedUnit.alloc.teacher_id,
                        day: sTarget.day,
                        period_index: sTarget.period_index,
                        is_locked: 0
                      }];
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

console.log('Testing restarts with 2-slot swap repair...');

for (let r = 0; r < 200; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

  if (rep.unplacedCount === 0) {
    console.log(`🎉 Direct success on restart ${r}!`);
    break;
  } else if (rep.unplacedCount === 1) {
    console.log(`Restart ${r}: unplaced=1 (${subjectMap[(rep.unplaced[0].alloc||rep.unplaced[0].allocA).subject_id].code}). Testing swap repair...`);
    const solved = tryRepairWithSwap(rep.slots, rep.unplaced);
    if (solved) {
      console.log(`\n🎉🎉🎉 COMPLETE SUCCESS ON RESTART ${r} WITH SWAP REPAIR! All 246 slots placed! 🎉🎉🎉`);
      const val = validateTimetable(solved, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
      console.log('\nVALIDATION RESULT:');
      console.log('  isValid:', val.isValid);
      console.log('  conflicts:', val.conflicts.length);
      console.log('  warnings:', val.warnings.length);
      if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
      if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
      break;
    }
  }
}
