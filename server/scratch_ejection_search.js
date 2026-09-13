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

// We want to place the unplaced unit by finding a chain of moves:
// u -> (d1, p1) [ejecting s1]
// s1 -> (d2, p2) [ejecting s2]
// ...
// sk -> empty slot

const unplacedUnit = rep.unplaced[0];
console.log('Unplaced:', unplacedUnit);

// Helper to check if a slot is empty across all classes / in a class
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Find all empty slots in the school:
const emptySlots = [];
for (const cls of classes) {
  const isJunior = cls.name?.startsWith('JS') || cls.level === 'JS';
  for (const day of days) {
    const maxP = day === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
    for (let p = startP; p <= maxP; p++) {
      const occ = rep.slots.some(s => s.class_id === cls.id && s.day === day && s.period_index === p);
      if (!occ) {
        emptySlots.push({ class_id: cls.id, className: cls.name, day, period: p });
      }
    }
  }
}
console.log('Empty slots in school:', emptySlots);

// Breadth-First Search for ejection chain
// State: { slots: Array, lastMoved: String, history: Array }
function searchChain() {
  const queue = [];
  // Level 1: try placing unplacedUnit into any slot in its class (class_id: 458 - JS 2)
  const js2 = classes.find(c => c.name === 'JS 2');

  for (const day of days) {
    const maxP = day === 'Friday' ? 4 : 8;
    const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
    for (let p = startP; p <= maxP; p++) {
      // Slot in JS 2 at (day, p)
      const existingInClass = rep.slots.filter(s => s.class_id === js2.id && s.day === day && s.period_index === p);
      if (existingInClass.length === 0) {
        // Direct placement
        if (gen._canPlaceSlot(unplacedUnit, day, p, rep.slots, classMap, teacherMap, subjectMap)) {
          console.log(`Direct placement found: ${day} P${p}`);
          return;
        }
      } else if (existingInClass.length === 1) {
        const ex = existingInClass[0];
        // Can unplacedUnit replace ex?
        const withoutEx = rep.slots.filter(s => s !== ex);
        if (gen._canPlaceSlot(unplacedUnit, day, p, withoutEx, classMap, teacherMap, subjectMap)) {
          // unplacedUnit can take this slot! Now ex needs a new slot.
          const exUnit = {
            class_id: js2.id,
            duration: 1,
            isPaired: false,
            alloc: { subject_id: ex.subject_id, teacher_id: ex.teacher_id, class_id: js2.id }
          };
          const slotsWithU = [...withoutEx, {
            class_id: js2.id,
            subject_id: unplacedUnit.alloc.subject_id,
            teacher_id: unplacedUnit.alloc.teacher_id,
            day,
            period_index: p,
            is_locked: 0
          }];
          queue.push({
            currentSlots: slotsWithU,
            pendingUnit: exUnit,
            history: [`[JS 2] IRS -> ${day} P${p} (ejected ${subjectMap[ex.subject_id].code})`],
            depth: 1
          });
        }
      }
    }
  }

  console.log(`Level 1 candidates: ${queue.length}`);

  let foundSolution = null;

  while (queue.length > 0) {
    const item = queue.shift();
    if (item.depth > 4) continue; // max depth 4

    const u = item.pendingUnit;
    const cls = classMap[u.class_id];
    const isJunior = cls.name?.startsWith('JS') || cls.level === 'JS';

    // Can u be placed into an empty slot in its class?
    for (const day of days) {
      const maxP = day === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        const occ = item.currentSlots.some(s => s.class_id === u.class_id && s.day === day && s.period_index === p);
        if (!occ) {
          // Empty slot in class!
          if (gen._canPlaceSlot(u, day, p, item.currentSlots, classMap, teacherMap, subjectMap)) {
            const finalSlots = [...item.currentSlots, {
              class_id: u.class_id,
              subject_id: u.alloc.subject_id,
              teacher_id: u.alloc.teacher_id,
              day,
              period_index: p,
              is_locked: 0
            }];
            foundSolution = {
              slots: finalSlots,
              history: [...item.history, `[${cls.name}] ${subjectMap[u.alloc.subject_id].code} -> ${day} P${p} (EMPTY)`]
            };
            break;
          }
        } else {
          // Only explore further ejections if depth < 3
          if (item.depth < 3) {
            const existingGroup = item.currentSlots.filter(s => s.class_id === u.class_id && s.day === day && s.period_index === p);
            if (existingGroup.length === 1 && !existingGroup[0].isPaired) {
              const ex = existingGroup[0];
              // Avoid ping-ponging the same subject
              if (item.history.some(h => h.includes(subjectMap[ex.subject_id].code))) continue;
              const withoutEx = item.currentSlots.filter(s => s !== ex);
              if (gen._canPlaceSlot(u, day, p, withoutEx, classMap, teacherMap, subjectMap)) {
                const exUnit = {
                  class_id: u.class_id,
                  duration: 1,
                  isPaired: false,
                  alloc: { subject_id: ex.subject_id, teacher_id: ex.teacher_id, class_id: u.class_id }
                };
                const slotsWithU = [...withoutEx, {
                  class_id: u.class_id,
                  subject_id: u.alloc.subject_id,
                  teacher_id: u.alloc.teacher_id,
                  day,
                  period_index: p,
                  is_locked: 0
                }];
                queue.push({
                  currentSlots: slotsWithU,
                  pendingUnit: exUnit,
                  history: [...item.history, `[${cls.name}] ${subjectMap[u.alloc.subject_id].code} -> ${day} P${p} (ejected ${subjectMap[ex.subject_id].code})`],
                  depth: item.depth + 1
                });
              }
            }
          }
        }
      }
      if (foundSolution) break;
    }
    if (foundSolution) break;
  }

  if (foundSolution) {
    console.log('\n🎉🎉🎉 FOUND SOLUTION VIA EJECTION CHAIN! 🎉🎉🎉');
    console.log('History:');
    foundSolution.history.forEach(h => console.log('  ' + h));
    console.log(`Total slots: ${foundSolution.slots.length} / 246`);

    const val = validateTimetable(foundSolution.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
    console.log('\nValidation:');
    console.log('  isValid:', val.isValid);
    console.log('  conflicts:', val.conflicts.length);
    console.log('  warnings:', val.warnings.length);
    if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
    if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
  } else {
    console.log('No solution found within depth limit.');
  }
}

searchChain();
