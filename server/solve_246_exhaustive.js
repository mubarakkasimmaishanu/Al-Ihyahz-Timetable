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
const targetClassId = unplacedUnit.class_id;

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

// Queue for BFS
// State: { slots: Array, history: Array, depth: Number }
const queue = [{
  slots: rep.slots,
  history: [],
  depth: 0
}];

const visitedStates = new Set();

function stateKey(slots) {
  // Sort slots by class_id, day, period_index, subject_id
  return slots.map(s => `${s.class_id}:${s.day}:${s.period_index}:${s.subject_id}`).sort().join('|');
}

visitedStates.add(stateKey(rep.slots));

let solution = null;
let maxExploredDepth = 0;

console.log('Starting BFS across all possible transitions...');

while (queue.length > 0) {
  const current = queue.shift();

  if (current.depth > maxExploredDepth) {
    maxExploredDepth = current.depth;
    console.log(`Exploring depth ${maxExploredDepth}, queue size: ${queue.length}`);
  }

  // Check if unplacedUnit can be placed in any empty slot
  const empties = getEmptySlots(current.slots);
  for (const e of empties) {
    if (e.class_id === targetClassId && gen._canPlaceSlot(unplacedUnit, e.day, e.period, current.slots, classMap, teacherMap, subjectMap)) {
      solution = {
        slots: [...current.slots, {
          class_id: targetClassId,
          subject_id: unplacedUnit.alloc.subject_id,
          teacher_id: unplacedUnit.alloc.teacher_id,
          day: e.day,
          period_index: e.period,
          is_locked: 0
        }],
        history: [...current.history, `PLACE [${classMap[targetClassId].name}] IRS at ${e.day} P${e.period}`]
      };
      break;
    }
  }
  if (solution) break;

  if (current.depth >= 5) continue; // max search depth

  // Generate next states: move a single slot S to an empty slot in its class
  for (const e of empties) {
    for (const s of current.slots) {
      if (s.class_id === e.class_id && !s.is_locked) {
        // Don't immediately undo the previous move
        if (current.history.length > 0) {
          const lastH = current.history[current.history.length - 1];
          if (lastH.includes(`-> ${s.day} P${s.period_index}`)) continue;
        }

        const withoutS = current.slots.filter(x => x !== s);
        const u = {
          class_id: s.class_id,
          duration: 1,
          isPaired: false,
          alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: s.class_id }
        };

        if (gen._canPlaceSlot(u, e.day, e.period, withoutS, classMap, teacherMap, subjectMap)) {
          const newSlots = [...withoutS, { ...s, day: e.day, period_index: e.period }];
          const key = stateKey(newSlots);
          if (!visitedStates.has(key)) {
            visitedStates.add(key);
            queue.push({
              slots: newSlots,
              history: [...current.history, `MOVE [${classMap[s.class_id].name}] ${subjectMap[s.subject_id].code} (${teacherMap[s.teacher_id].name}) ${s.day} P${s.period_index} -> ${e.day} P${e.period}`],
              depth: current.depth + 1
            });
          }
        }
      }
    }
  }
}

if (solution) {
  console.log('\n🎉🎉🎉 BFS FOUND A COMPLETE SOLUTION! 🎉🎉🎉');
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
  console.log('\nNo solution found within depth limit.');
}
