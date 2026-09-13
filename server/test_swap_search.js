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

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

console.log(`Starting: placed=${rep.slots.length}/246, unplaced=${rep.unplaced.length}`);
const unplacedUnit = rep.unplaced[0];
const targetClassId = unplacedUnit.class_id;

// We want to test:
// 1. Can we swap two slots A and B in some class C?
// 2. Then check if:
//    a) unplacedUnit can be placed directly into an empty slot, OR
//    b) some slot S can move to an empty slot, and then unplacedUnit can take S's old slot!

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getEmptySlots(currentSlots) {
  const empties = [];
  for (const cls of classes) {
    const isJunior = cls.name?.startsWith('JS') || cls.level === 'JS';
    for (const d of days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        if (!currentSlots.some(s => s.class_id === cls.id && s.day === d && s.period_index === p)) {
          empties.push({ class_id: cls.id, day: d, period: p });
        }
      }
    }
  }
  return empties;
}

const initialEmpties = getEmptySlots(rep.slots);
console.log('Initial empty slots:', initialEmpties);

// Find all single slots in the school
const singleSlots = rep.slots.filter(s => !s.is_locked);
console.log(`Total unlocked single slots: ${singleSlots.length}`);

let solution = null;

// Group single slots by class
const slotsByClass = {};
for (const s of singleSlots) {
  if (!slotsByClass[s.class_id]) slotsByClass[s.class_id] = [];
  slotsByClass[s.class_id].push(s);
}

// Iterate over each class to find valid 2-slot swaps
for (const [clsIdStr, cSlots] of Object.entries(slotsByClass)) {
  const clsId = Number(clsIdStr);
  const cls = classMap[clsId];

  for (let i = 0; i < cSlots.length; i++) {
    for (let j = i + 1; j < cSlots.length; j++) {
      const sA = cSlots[i];
      const sB = cSlots[j];

      // If they are on the same day and period, continue
      if (sA.day === sB.day && sA.period_index === sB.period_index) continue;
      // If they have the same subject and teacher, swapping does nothing
      if (sA.subject_id === sB.subject_id && sA.teacher_id === sB.teacher_id) continue;

      // Test if sA can move to sB's slot, and sB can move to sA's slot:
      const withoutBoth = rep.slots.filter(x => x !== sA && x !== sB);
      const unitA = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sA.subject_id, teacher_id: sA.teacher_id, class_id: clsId } };
      const unitB = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sB.subject_id, teacher_id: sB.teacher_id, class_id: clsId } };

      // Can unitA go to sB's position?
      if (gen._canPlaceSlot(unitA, sB.day, sB.period_index, withoutBoth, classMap, teacherMap, subjectMap)) {
        const withAAtB = [...withoutBoth, { ...sA, day: sB.day, period_index: sB.period_index }];
        // Can unitB go to sA's position?
        if (gen._canPlaceSlot(unitB, sA.day, sA.period_index, withAAtB, classMap, teacherMap, subjectMap)) {
          // SWAP IS VALID!
          const swappedSlots = [...withAAtB, { ...sB, day: sA.day, period_index: sA.period_index }];

          // Now test option A: Direct placement of unplacedUnit into empty slot
          for (const e of initialEmpties) {
            if (e.class_id === targetClassId && gen._canPlaceSlot(unplacedUnit, e.day, e.period, swappedSlots, classMap, teacherMap, subjectMap)) {
              solution = {
                slots: [...swappedSlots, {
                  class_id: targetClassId,
                  subject_id: unplacedUnit.alloc.subject_id,
                  teacher_id: unplacedUnit.alloc.teacher_id,
                  day: e.day,
                  period_index: e.period,
                  is_locked: 0
                }],
                description: `Swapped [${cls.name}] ${subjectMap[sA.subject_id].code} (${sA.day} P${sA.period_index}) with ${subjectMap[sB.subject_id].code} (${sB.day} P${sB.period_index}), then placed [${classMap[targetClassId].name}] IRS at ${e.day} P${e.period}`
              };
              break;
            }
          }
          if (solution) break;

          // Test option B: 1-step move of some slot S in targetClass to empty slot e, then unplacedUnit into S's old slot
          for (const e of initialEmpties) {
            if (e.class_id === targetClassId) {
              for (const sTarget of swappedSlots.filter(s => s.class_id === targetClassId)) {
                const withoutSTarget = swappedSlots.filter(x => x !== sTarget);
                const uTarget = { class_id: targetClassId, duration: 1, isPaired: false, alloc: { subject_id: sTarget.subject_id, teacher_id: sTarget.teacher_id, class_id: targetClassId } };
                if (gen._canPlaceSlot(uTarget, e.day, e.period, withoutSTarget, classMap, teacherMap, subjectMap)) {
                  const withSTargetAtE = [...withoutSTarget, { ...sTarget, day: e.day, period_index: e.period }];
                  if (gen._canPlaceSlot(unplacedUnit, sTarget.day, sTarget.period_index, withSTargetAtE, classMap, teacherMap, subjectMap)) {
                    solution = {
                      slots: [...withSTargetAtE, {
                        class_id: targetClassId,
                        subject_id: unplacedUnit.alloc.subject_id,
                        teacher_id: unplacedUnit.alloc.teacher_id,
                        day: sTarget.day,
                        period_index: sTarget.period_index,
                        is_locked: 0
                      }],
                      description: `Swapped [${cls.name}] ${subjectMap[sA.subject_id].code} (${sA.day} P${sA.period_index}) with ${subjectMap[sB.subject_id].code} (${sB.day} P${sB.period_index}), moved [${classMap[targetClassId].name}] ${subjectMap[sTarget.subject_id].code} (${sTarget.day} P${sTarget.period_index} -> ${e.day} P${e.period}), and placed IRS at ${sTarget.day} P${sTarget.period_index}`
                    };
                    break;
                  }
                }
              }
            }
            if (solution) break;
          }
          if (solution) break;
        }
      }
    }
    if (solution) break;
  }
  if (solution) break;
}

if (solution) {
  console.log('\n🎉🎉🎉 FOUND SOLUTION VIA 2-SLOT SWAP SEARCH! 🎉🎉🎉');
  console.log(solution.description);
  console.log(`Total slots: ${solution.slots.length} / 246`);

  const val = validateTimetable(solution.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('\nVALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
  if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
} else {
  console.log('\nNo solution found via single 2-slot swap.');
}
