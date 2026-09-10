import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

console.log('Testing repair / swap algorithm on greedy results...');

// Helper: can slot be placed at day, period?
function canPlace(unit, day, period, currentSlots) {
  const p2 = unit.duration === 2 ? period + 1 : null;
  const maxP = day === 'Friday' ? 6 : 8;
  if (period > maxP || (p2 && p2 > maxP)) return false;

  // Assembly rule
  if ((day === 'Monday' || day === 'Friday') && (period === 1 || p2 === 1)) return false;

  // Break span rule
  if (day !== 'Friday' && unit.duration === 2 && period === 4) return false;
  if (day === 'Friday' && unit.duration === 2) return false;

  // Friday class max
  const cls = classMap[unit.class_id];
  const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
  if (isJunior && day === 'Friday' && (period > 4 || (p2 && p2 > 4))) return false;
  if (day === 'Friday' && (period > 6 || (p2 && p2 > 6))) return false;

  // Class occupancy
  const cBusy1 = currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === period);
  const cBusy2 = p2 ? currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === p2) : false;
  if (cBusy1 || cBusy2) return false;

  // Teachers
  const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
  for (const tId of tIds) {
    const t = teacherMap[tId];
    if (t?.unavailable_days && t.unavailable_days.includes(day)) return false;
    if (t?.time_preference === 'MORNING_ONLY' && (period > 6 || (p2 && p2 > 6))) return false;

    const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
    const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
    if (tBusy1 || tBusy2) return false;
  }

  // Subject restrictions
  const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
  for (const sId of sIds) {
    const sub = subjectMap[sId];
    const code = (sub?.code || '').toUpperCase();
    if (code === 'CHM' && (period === 8 || p2 === 8)) return false;
    if (code === 'MTH' && (period >= 7 || (p2 && p2 >= 7) || (day === 'Friday' && period >= 5))) return false;
    if (code === 'ENG' && (period >= 8 || (p2 && p2 >= 8) || (day === 'Friday' && period >= 5))) return false;
  }

  return true;
}

// Run 30 restarts and apply repair on results with <= 4 unplaced
let solved = false;
for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedCount === 0) {
    console.log(`Direct solve on restart ${r}!`);
    solved = true;
    break;
  }
  if (res.unplacedCount <= 4) {
    // Attempt 1-step swap for each unplaced unit
    const currentSlots = [...res.slots];
    const unplaced = [...res.unplacedUnits];
    let repaired = 0;

    for (let uIdx = unplaced.length - 1; uIdx >= 0; uIdx--) {
      const unit = unplaced[uIdx];
      const cls = classMap[unit.class_id];
      const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
      let unitPlaced = false;

      // Find all empty slots in this class
      const emptySlots = [];
      for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
        const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : (isJunior && d === 'Monday' ? 8 : 8);
        const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
        for (let p = startP; p <= maxP; p++) {
          if (!currentSlots.some(s => s.class_id === unit.class_id && s.day === d && s.period_index === p)) {
            emptySlots.push({ day: d, period: p });
          }
        }
      }

      // 1. Direct placement check
      for (const e of emptySlots) {
        if (canPlace(unit, e.day, e.period, currentSlots)) {
          // Place directly!
          const alloc = unit.alloc || unit.allocA;
          currentSlots.push({
            class_id: unit.class_id,
            subject_id: alloc.subject_id,
            teacher_id: alloc.teacher_id,
            day: e.day,
            period_index: e.period,
            is_locked: 0
          });
          unitPlaced = true;
          repaired++;
          unplaced.splice(uIdx, 1);
          break;
        }
      }
      if (unitPlaced) continue;

      // 2. 1-step swap: find a placed slot V in this class that can move to an empty slot
      for (const e of emptySlots) {
        // Look through existing slots of this class
        const classSlots = currentSlots.filter(s => s.class_id === unit.class_id);
        for (const existing of classSlots) {
          // Check if existing is a single slot (not part of paired or double)
          // Create temporary unit for existing
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

          // Remove existing temporarily
          const withoutExisting = currentSlots.filter(s => s !== existing);

          // Can existing move to empty slot e?
          if (canPlace(existingUnit, e.day, e.period, withoutExisting)) {
            // If existing moves to e, can unit go into existing's old slot?
            const withExistingAtE = [...withoutExisting, {
              ...existing,
              day: e.day,
              period_index: e.period
            }];

            if (canPlace(unit, existing.day, existing.period_index, withExistingAtE)) {
              // Swap succeeded!
              const oldDay = existing.day;
              const oldPeriod = existing.period_index;
              existing.day = e.day;
              existing.period_index = e.period;
              const alloc = unit.alloc || unit.allocA;
              currentSlots.push({
                class_id: unit.class_id,
                subject_id: alloc.subject_id,
                teacher_id: alloc.teacher_id,
                day: oldDay,
                period_index: oldPeriod,
                is_locked: 0
              });
              unitPlaced = true;
              repaired++;
              unplaced.splice(uIdx, 1);
              break;
            }
          }
        }
        if (unitPlaced) break;
      }
    }

    if (unplaced.length === 0) {
      console.log(`>>> REPAIR SOLVED ALL UNPLACED UNITS! Total slots: ${currentSlots.length} on restart ${r}! <<<`);
      const val = validateTimetable(currentSlots, classes, teachers, subjects, allocations, {
        fridayPeriods: 6,
        regularPeriods: 8
      });
      console.log('Validation:', val.isValid, 'Conflicts:', val.conflicts.length, 'Warnings:', val.warnings.length);
      if (val.isValid) {
        solved = true;
        break;
      }
    }
  }
}
