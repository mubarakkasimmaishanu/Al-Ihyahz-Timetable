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

const unplacedUnit = rep.unplaced[0];
console.log('Unplaced unit:', unplacedUnit);

// Let's test a Min-Conflicts local search repair!
// In Min-Conflicts:
// We place unplacedUnit into ANY valid candidate slot (even if that slot is currently occupied by some existing slot S).
// Then S becomes unplaced (ejected).
// Then we find a place for S (either empty, or ejecting another slot S2).
// Up to depth 4 or 5!

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function canPlace(unit, day, period, currentSlots) {
  return gen._canPlaceSlot(unit, day, period, currentSlots, classMap, teacherMap, subjectMap);
}

// Convert slot to unit
function slotToUnit(s) {
  return {
    class_id: s.class_id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: s.class_id }
  };
}

// Search for an ejection chain:
// Queue of states: { slots: Array, unplaced: Unit, history: Array, depth: Number }
const queue = [{
  slots: rep.slots.map(s => ({ ...s })),
  unplaced: unplacedUnit,
  history: [],
  depth: 0
}];

const visited = new Set();
function getSignature(slots, u) {
  return `${u.class_id}:${u.alloc.subject_id}:${u.alloc.teacher_id}|` + 
    slots.map(s => `${s.class_id},${s.day},${s.period_index},${s.subject_id}`).sort().join(';');
}

visited.add(getSignature(rep.slots, unplacedUnit));

let solution = null;

console.log('Starting generalized ejection chain search...');

while (queue.length > 0) {
  const current = queue.shift();
  if (current.depth > 4) continue;

  const u = current.unplaced;
  const uClass = classMap[u.class_id];
  const isJunior = uClass.name?.startsWith('JS') || uClass.level === 'JS';

  // 1. Try placing u into an empty slot in its class
  for (const day of days) {
    const maxP = day === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
    for (let p = startP; p <= maxP; p++) {
      const isOccupied = current.slots.some(s => s.class_id === u.class_id && s.day === day && s.period_index === p);
      if (!isOccupied) {
        if (canPlace(u, day, p, current.slots)) {
          const finalSlots = [...current.slots, {
            class_id: u.class_id,
            subject_id: u.alloc.subject_id,
            teacher_id: u.alloc.teacher_id,
            day,
            period_index: p,
            is_locked: 0
          }];
          solution = {
            slots: finalSlots,
            history: [...current.history, `PLACE [${uClass.name}] ${subjectMap[u.alloc.subject_id].code} at ${day} P${p} (EMPTY)`]
          };
          break;
        }
      }
    }
    if (solution) break;
  }
  if (solution) break;

  // 2. Try ejecting an existing slot in u's class
  for (const day of days) {
    const maxP = day === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
    for (let p = startP; p <= maxP; p++) {
      const occSlots = current.slots.filter(s => s.class_id === u.class_id && s.day === day && s.period_index === p);
      if (occSlots.length === 1 && !occSlots[0].is_locked) {
        const occ = occSlots[0];
        // Can u take this slot if occ is removed?
        const withoutOcc = current.slots.filter(s => s !== occ);
        if (canPlace(u, day, p, withoutOcc)) {
          const withUNew = [...withoutOcc, {
            class_id: u.class_id,
            subject_id: u.alloc.subject_id,
            teacher_id: u.alloc.teacher_id,
            day,
            period_index: p,
            is_locked: 0
          }];
          const nextUnit = slotToUnit(occ);
          const sig = getSignature(withUNew, nextUnit);
          if (!visited.has(sig)) {
            visited.add(sig);
            queue.push({
              slots: withUNew,
              unplaced: nextUnit,
              history: [...current.history, `[${uClass.name}] ${subjectMap[u.alloc.subject_id].code} -> ${day} P${p} (ejected ${subjectMap[occ.subject_id].code})`],
              depth: current.depth + 1
            });
          }
        }
      }
    }
  }
}

if (solution) {
  console.log('\n🎉🎉🎉 FOUND SOLUTION! 🎉🎉🎉');
  console.log(`Total moves: ${solution.history.length}`);
  solution.history.forEach((h, i) => console.log(`  Step ${i + 1}: ${h}`));
  console.log(`Total slots: ${solution.slots.length} / 246`);

  const val = validateTimetable(solution.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('\nVALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
  if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
} else {
  console.log('\nNo solution found by ejection chain.');
}
