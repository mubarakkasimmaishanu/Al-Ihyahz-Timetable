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

console.log(`Starting BFS solver: placed=${rep.slots.length}/246, unplaced=${rep.unplaced.length}`);

// Function to find all empty slots for all classes
function getEmptySlots(slots) {
  const empty = [];
  for (const c of classes) {
    const isJunior = c.name.startsWith('JS');
    for (const d of gen.days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        if (!slots.some(s => s.class_id === c.id && s.day === d && s.period_index === p)) {
          empty.push({ class_id: c.id, day: d, period: p });
        }
      }
    }
  }
  return empty;
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

// State representation: hash of slots + unplaced
function stateHash(slots, unplaced) {
  const sStr = slots.map(s => `${s.class_id}-${s.subject_id}-${s.day}-${s.period_index}`).sort().join('|');
  const uStr = unplaced.map(u => `${u.class_id}-${(u.alloc||u.allocA).subject_id}`).sort().join('|');
  return sStr + '::' + uStr;
}

// BFS Queue
const queue = [{
  slots: rep.slots.map(s => ({ ...s })),
  unplaced: [...rep.unplaced],
  path: []
}];

const visited = new Set();
visited.add(stateHash(rep.slots, rep.unplaced));

let solution = null;
let iterations = 0;

while (queue.length > 0 && iterations < 5000) {
  iterations++;
  const current = queue.shift();

  if (current.unplaced.length === 0) {
    solution = current;
    console.log(`\n🎉🎉🎉 BFS FOUND 100% COMPLETE SOLUTION in ${iterations} iterations! All 246 slots placed! 🎉🎉🎉`);
    break;
  }

  const emptySlots = getEmptySlots(current.slots);

  // 1. Try placing any unplaced unit directly into an empty slot
  for (let uIdx = 0; uIdx < current.unplaced.length; uIdx++) {
    const u = current.unplaced[uIdx];
    const matchingEmpty = emptySlots.filter(e => e.class_id === u.class_id);

    for (const e of matchingEmpty) {
      if (gen._canPlaceSlot(u, e.day, e.period, current.slots, classMap, teacherMap, subjectMap)) {
        const nextSlots = current.slots.map(s => ({ ...s }));
        nextSlots.push({
          class_id: u.class_id,
          subject_id: (u.alloc || u.allocA).subject_id,
          teacher_id: (u.alloc || u.allocA).teacher_id,
          day: e.day,
          period_index: e.period,
          is_locked: 0
        });
        const nextUnplaced = current.unplaced.filter((_, idx) => idx !== uIdx);
        const h = stateHash(nextSlots, nextUnplaced);

        if (!visited.has(h)) {
          visited.add(h);
          queue.push({
            slots: nextSlots,
            unplaced: nextUnplaced,
            path: [...current.path, `Placed [${classMap[u.class_id]?.name} ${subjectMap[(u.alloc||u.allocA).subject_id]?.code}] at ${e.day} P${e.period}`]
          });
        }
      }
    }
  }

  // 2. Try moving a single period from an occupied slot to an empty slot of the same class
  // Only search depth <= 5
  if (current.path.length < 5) {
    for (const e of emptySlots) {
      // Find candidate slots in the same class to move to e
      const classSlots = current.slots.filter(s => s.class_id === e.class_id);

      for (const occ of classSlots) {
        if (occ.day === e.day && occ.period_index === e.period) continue;

        const occUnit = slotToUnit(occ);
        const withoutOcc = current.slots.filter(s => s !== occ);

        if (gen._canPlaceSlot(occUnit, e.day, e.period, withoutOcc, classMap, teacherMap, subjectMap)) {
          const nextSlots = withoutOcc.map(s => ({ ...s }));
          nextSlots.push({
            class_id: occ.class_id,
            subject_id: occ.subject_id,
            teacher_id: occ.teacher_id,
            day: e.day,
            period_index: e.period,
            is_locked: 0
          });

          const h = stateHash(nextSlots, current.unplaced);
          if (!visited.has(h)) {
            visited.add(h);
            queue.push({
              slots: nextSlots,
              unplaced: current.unplaced,
              path: [...current.path, `Moved [${classMap[occ.class_id]?.name} ${subjectMap[occ.subject_id]?.code}] from ${occ.day} P${occ.period_index} to ${e.day} P${e.period}`]
            });
          }
        }
      }
    }
  }

  if (iterations % 500 === 0) {
    console.log(`BFS progress: iterations=${iterations}, queueSize=${queue.length}, visited=${visited.size}`);
  }
}

if (solution) {
  console.log(`\nSolution path (${solution.path.length} steps):`);
  solution.path.forEach((p, idx) => console.log(`  Step ${idx + 1}: ${p}`));

  console.log(`\nTotal slots in solution: ${solution.slots.length} / 246`);
  const val = validateTimetable(solution.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('VALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
  if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
} else {
  console.log(`BFS did not find solution in ${iterations} iterations.`);
}
