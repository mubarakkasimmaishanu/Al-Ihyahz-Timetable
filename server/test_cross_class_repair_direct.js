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
const targetTeacherId = unplacedUnit.alloc.teacher_id;
const targetClassId = unplacedUnit.class_id;

console.log(`Target: place [${classMap[targetClassId].name}] ${subjectMap[unplacedUnit.alloc.subject_id].code} (${teacherMap[targetTeacherId].name})`);

// Find all slots of targetTeacher in OTHER classes:
const otherSlotsOfTeacher = rep.slots.filter(s => s.teacher_id === targetTeacherId && s.class_id !== targetClassId);
console.log(`Teacher has ${otherSlotsOfTeacher.length} slots in other classes.`);

// For each slot of teacher in other classes:
// Can that slot move or swap within its own class to free teacher at that day/period?
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

let solution = null;

for (const tSlot of otherSlotsOfTeacher) {
  const otherClassId = tSlot.class_id;
  const otherClass = classMap[otherClassId];
  const isOtherJunior = otherClass.name?.startsWith('JS') || otherClass.level === 'JS';

  // Can tSlot move to another period in otherClass where tSlot is valid?
  // In otherClass, check all periods (d2, p2):
  for (const d2 of days) {
    const maxP = d2 === 'Friday' ? (isOtherJunior ? 4 : 6) : 8;
    const startP = (d2 === 'Monday' || d2 === 'Friday') ? 2 : 1;
    for (let p2 = startP; p2 <= maxP; p2++) {
      if (d2 === tSlot.day && p2 === tSlot.period_index) continue;

      // Check slot occupant in otherClass at (d2, p2)
      const occupant = rep.slots.find(s => s.class_id === otherClassId && s.day === d2 && s.period_index === p2);
      if (!occupant) continue; // no empty slots in other classes

      // Can tSlot and occupant SWAP in otherClass?
      // i.e. tSlot moves to (d2, p2), occupant moves to (tSlot.day, tSlot.period_index)
      const withoutBoth = rep.slots.filter(s => s !== tSlot && s !== occupant);

      const tUnit = {
        class_id: otherClassId,
        duration: 1,
        isPaired: false,
        alloc: { subject_id: tSlot.subject_id, teacher_id: tSlot.teacher_id, class_id: otherClassId }
      };
      const occUnit = {
        class_id: otherClassId,
        duration: 1,
        isPaired: false,
        alloc: { subject_id: occupant.subject_id, teacher_id: occupant.teacher_id, class_id: otherClassId }
      };

      if (gen._canPlaceSlot(tUnit, d2, p2, withoutBoth, classMap, teacherMap, subjectMap)) {
        const withTAt2 = [...withoutBoth, { ...tSlot, day: d2, period_index: p2 }];
        if (gen._canPlaceSlot(occUnit, tSlot.day, tSlot.period_index, withTAt2, classMap, teacherMap, subjectMap)) {
          // Swap in otherClass is LEGAL!
          // Now teacher is free at (tSlot.day, tSlot.period_index)!
          const slotsAfterSwap = [...withTAt2, { ...occupant, day: tSlot.day, period_index: tSlot.period_index }];
          
          // Can unplacedUnit now be placed in targetClass at (tSlot.day, tSlot.period_index)?
          // Note: in targetClass, is (tSlot.day, tSlot.period_index) empty or occupied?
          const targetOcc = slotsAfterSwap.find(s => s.class_id === targetClassId && s.day === tSlot.day && s.period_index === tSlot.period_index);
          
          if (!targetOcc) {
            // It's empty in targetClass!
            if (gen._canPlaceSlot(unplacedUnit, tSlot.day, tSlot.period_index, slotsAfterSwap, classMap, teacherMap, subjectMap)) {
              solution = {
                slots: [...slotsAfterSwap, {
                  class_id: targetClassId,
                  subject_id: unplacedUnit.alloc.subject_id,
                  teacher_id: unplacedUnit.alloc.teacher_id,
                  day: tSlot.day,
                  period_index: tSlot.period_index,
                  is_locked: 0
                }],
                description: `Swapped [${otherClass.name}] ${subjectMap[tSlot.subject_id].code} (${tSlot.day} P${tSlot.period_index}) with ${subjectMap[occupant.subject_id].code} (${d2} P${p2}), then placed [${classMap[targetClassId].name}] IRS at ${tSlot.day} P${tSlot.period_index}`
              };
              break;
            }
          }
        }
      }
    }
    if (solution) break;
  }
  if (solution) break;
}

if (solution) {
  console.log('\n🎉🎉🎉 FOUND SOLUTION VIA CROSS-CLASS REPAIR! 🎉🎉🎉');
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
  console.log('\nNo direct cross-class swap found for teacher.');
}
