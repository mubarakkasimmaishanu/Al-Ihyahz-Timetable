import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

// Helper to get scheduled groups at (class_id, day, period)
function getSlotGroup(slots, class_id, day, period) {
  return slots.filter(s => s.class_id === class_id && s.day === day && s.period_index === period);
}

function convertGroupToUnit(group, class_id) {
  if (group.length === 2) {
    return {
      class_id,
      duration: 1,
      isPaired: true,
      allocA: { subject_id: group[0].subject_id, teacher_id: group[0].teacher_id, class_id },
      allocB: { subject_id: group[1].subject_id, teacher_id: group[1].teacher_id, class_id }
    };
  }
  return {
    class_id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: group[0].subject_id, teacher_id: group[0].teacher_id, class_id }
  };
}

export function ejectionChainRepair(slots, unplacedUnits, gen) {
  let currentSlots = [...slots];
  const unplaced = [...unplacedUnits];

  for (let uIdx = unplaced.length - 1; uIdx >= 0; uIdx--) {
    const unit = unplaced[uIdx];
    const cls = classMap[unit.class_id];
    const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
    let unitPlaced = false;

    // Find all empty slots for this class
    const emptySlots = [];
    for (const d of gen.days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        if (!currentSlots.some(s => s.class_id === unit.class_id && s.day === d && s.period_index === p)) {
          emptySlots.push({ day: d, period: p });
        }
      }
    }

    // Step 1: Direct placement
    for (const e of emptySlots) {
      if (gen._canPlaceSlot(unit, e.day, e.period, currentSlots, classMap, teacherMap, subjectMap)) {
        for (let offset = 0; offset < unit.duration; offset++) {
          const pIdx = e.period + offset;
          if (unit.isPaired) {
            currentSlots.push(
              { class_id: unit.class_id, subject_id: unit.allocA.subject_id, teacher_id: unit.allocA.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 },
              { class_id: unit.class_id, subject_id: unit.allocB.subject_id, teacher_id: unit.allocB.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 }
            );
          } else {
            currentSlots.push(
              { class_id: unit.class_id, subject_id: unit.alloc.subject_id, teacher_id: unit.alloc.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 }
            );
          }
        }
        unitPlaced = true;
        unplaced.splice(uIdx, 1);
        break;
      }
    }
    if (unitPlaced) continue;

    // Step 2: 1-step swap
    // Find all occupied periods in unit.class_id
    const occupiedPeriods = [];
    for (const d of gen.days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        const grp = getSlotGroup(currentSlots, unit.class_id, d, p);
        if (grp.length > 0) {
          occupiedPeriods.push({ day: d, period: p, group: grp });
        }
      }
    }

    // Try moving occupied period to empty slot, and placing unit in its spot
    for (const occ of occupiedPeriods) {
      const occUnit = convertGroupToUnit(occ.group, unit.class_id);
      const withoutOcc = currentSlots.filter(s => !occ.group.includes(s));

      for (const e of emptySlots) {
        if (e.day === occ.day && e.period === occ.period) continue;

        // Can occUnit move to e?
        if (gen._canPlaceSlot(occUnit, e.day, e.period, withoutOcc, classMap, teacherMap, subjectMap)) {
          const movedGroup = occ.group.map(s => ({ ...s, day: e.day, period_index: e.period }));
          const withOccAtE = [...withoutOcc, ...movedGroup];

          // Can unit go into occ's old spot?
          if (gen._canPlaceSlot(unit, occ.day, occ.period, withOccAtE, classMap, teacherMap, subjectMap)) {
            // Apply move
            for (const s of occ.group) {
              s.day = e.day;
              s.period_index = e.period;
            }
            for (let offset = 0; offset < unit.duration; offset++) {
              const pIdx = occ.period + offset;
              if (unit.isPaired) {
                currentSlots.push(
                  { class_id: unit.class_id, subject_id: unit.allocA.subject_id, teacher_id: unit.allocA.teacher_id, day: occ.day, period_index: pIdx, is_locked: 0 },
                  { class_id: unit.class_id, subject_id: unit.allocB.subject_id, teacher_id: unit.allocB.teacher_id, day: occ.day, period_index: pIdx, is_locked: 0 }
                );
              } else {
                currentSlots.push(
                  { class_id: unit.class_id, subject_id: unit.alloc.subject_id, teacher_id: unit.alloc.teacher_id, day: occ.day, period_index: pIdx, is_locked: 0 }
                );
              }
            }
            unitPlaced = true;
            unplaced.splice(uIdx, 1);
            break;
          }
        }
      }
      if (unitPlaced) break;
    }
    if (unitPlaced) continue;

    // Step 3: 2-step chain (A -> B -> empty)
    // Find occupied period 1 (occ1) that can move to occ2, where occ2 can move to empty slot e
    for (const occ1 of occupiedPeriods) {
      const occUnit1 = convertGroupToUnit(occ1.group, unit.class_id);
      const withoutOcc1 = currentSlots.filter(s => !occ1.group.includes(s));

      for (const occ2 of occupiedPeriods) {
        if (occ2.day === occ1.day && occ2.period === occ1.period) continue;
        const occUnit2 = convertGroupToUnit(occ2.group, unit.class_id);
        const withoutOcc1And2 = withoutOcc1.filter(s => !occ2.group.includes(s));

        for (const e of emptySlots) {
          if (e.day === occ2.day && e.period === occ2.period) continue;

          // Can occ2 move to e?
          if (gen._canPlaceSlot(occUnit2, e.day, e.period, withoutOcc1And2, classMap, teacherMap, subjectMap)) {
            const movedGroup2 = occ2.group.map(s => ({ ...s, day: e.day, period_index: e.period }));
            const with2AtE = [...withoutOcc1And2, ...movedGroup2];

            // Can occ1 move to occ2's old spot?
            if (gen._canPlaceSlot(occUnit1, occ2.day, occ2.period, with2AtE, classMap, teacherMap, subjectMap)) {
              const movedGroup1 = occ1.group.map(s => ({ ...s, day: occ2.day, period_index: occ2.period }));
              const with1At2 = [...with2AtE, ...movedGroup1];

              // Can unit go into occ1's old spot?
              if (gen._canPlaceSlot(unit, occ1.day, occ1.period, with1At2, classMap, teacherMap, subjectMap)) {
                // Apply all moves!
                for (const s of occ2.group) {
                  s.day = e.day;
                  s.period_index = e.period;
                }
                for (const s of occ1.group) {
                  s.day = occ2.day;
                  s.period_index = occ2.period;
                }
                for (let offset = 0; offset < unit.duration; offset++) {
                  const pIdx = occ1.period + offset;
                  if (unit.isPaired) {
                    currentSlots.push(
                      { class_id: unit.class_id, subject_id: unit.allocA.subject_id, teacher_id: unit.allocA.teacher_id, day: occ1.day, period_index: pIdx, is_locked: 0 },
                      { class_id: unit.class_id, subject_id: unit.allocB.subject_id, teacher_id: unit.allocB.teacher_id, day: occ1.day, period_index: pIdx, is_locked: 0 }
                    );
                  } else {
                    currentSlots.push(
                      { class_id: unit.class_id, subject_id: unit.alloc.subject_id, teacher_id: unit.alloc.teacher_id, day: occ1.day, period_index: pIdx, is_locked: 0 }
                    );
                  }
                }
                unitPlaced = true;
                unplaced.splice(uIdx, 1);
                break;
              }
            }
          }
        }
        if (unitPlaced) break;
      }
      if (unitPlaced) break;
    }
  }

  return {
    success: unplaced.length === 0,
    unplacedCount: unplaced.length,
    unplaced,
    slots: currentSlots
  };
}

console.log('Testing Ejection Chain Repair on generator-balanced...');
const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });

for (let r = 0; r < 40; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = ejectionChainRepair(res.slots, res.unplacedUnits, gen);
  console.log(`Restart ${r}: solve unplaced = ${res.unplacedCount} -> repaired unplaced = ${rep.unplacedCount} (slots: ${rep.slots.length})`);
  if (rep.unplacedCount === 0) {
    console.log(`\n>>> SUCCESS! EJECTION CHAIN REPAIRED ALL 246 SLOTS ON RESTART ${r}! <<<`);
    const val = validateTimetable(rep.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
    console.log('Validation Report:', val.isValid, 'Conflicts:', val.conflicts.length, 'Warnings:', val.warnings.length);
    if (val.conflicts.length > 0) console.log(val.conflicts);
    break;
  }
}
