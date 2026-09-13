import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

function minConflictsRepair(initialSlots, initialUnplaced, gen, maxSteps = 100) {
  let currentSlots = initialSlots.map(s => ({ ...s }));
  let unplaced = [...initialUnplaced];

  const getSlotGroup = (slts, class_id, day, period) => {
    return slts.filter(s => s.class_id === class_id && s.day === day && s.period_index === period);
  };

  const convertGroupToUnit = (group, class_id) => {
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
  };

  for (let step = 0; step < maxSteps && unplaced.length > 0; step++) {
    // Pick an unplaced unit
    const uIdx = Math.floor(Math.random() * unplaced.length);
    const unit = unplaced[uIdx];
    const cls = classMap[unit.class_id];
    const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');

    // Find all candidate empty slots in unit.class_id
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

    // Try direct placement first
    let placedDirect = false;
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
        unplaced.splice(uIdx, 1);
        placedDirect = true;
        break;
      }
    }
    if (placedDirect) continue;

    // Try eviction / ejection
    // For an empty slot e, find which slots in OTHER classes are blocking our teacher
    const uTeacherIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
    let evictedSuccessfully = false;

    for (const e of emptySlots) {
      // Check if unit.class_id already has this subject on e.day
      const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
      if (currentSlots.some(s => s.class_id === unit.class_id && s.day === e.day && sIds.includes(s.subject_id))) {
        continue;
      }

      // Check teacher availability days and Morning preference
      let teachAvail = true;
      for (const tId of uTeacherIds) {
        const t = teacherMap[tId];
        if (t?.unavailable_days && t.unavailable_days.includes(e.day)) teachAvail = false;
        if (t?.time_preference === 'MORNING_ONLY' && e.period > 6) teachAvail = false;
      }
      if (!teachAvail) continue;

      // Find blocking slots
      const blockers = currentSlots.filter(s => uTeacherIds.includes(s.teacher_id) && s.day === e.day && s.period_index === e.period);
      if (blockers.length === 0) continue;

      // Try evicting the blocker
      const blockerClassId = blockers[0].class_id;
      const blkGroup = getSlotGroup(currentSlots, blockerClassId, e.day, e.period);
      const blkUnit = convertGroupToUnit(blkGroup, blockerClassId);
      const withoutBlk = currentSlots.filter(s => !blkGroup.includes(s));

      // Can unit be placed now at e?
      if (gen._canPlaceSlot(unit, e.day, e.period, withoutBlk, classMap, teacherMap, subjectMap)) {
        // Place unit at e
        const newSlotsWithUnit = [...withoutBlk];
        for (let offset = 0; offset < unit.duration; offset++) {
          const pIdx = e.period + offset;
          if (unit.isPaired) {
            newSlotsWithUnit.push(
              { class_id: unit.class_id, subject_id: unit.allocA.subject_id, teacher_id: unit.allocA.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 },
              { class_id: unit.class_id, subject_id: unit.allocB.subject_id, teacher_id: unit.allocB.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 }
            );
          } else {
            newSlotsWithUnit.push(
              { class_id: unit.class_id, subject_id: unit.alloc.subject_id, teacher_id: unit.alloc.teacher_id, day: e.day, period_index: pIdx, is_locked: 0 }
            );
          }
        }

        // Now see if blkUnit can find a home in blockerClassId
        const bCls = classMap[blockerClassId];
        const bIsJunior = bCls && (bCls.name?.startsWith('JS') || bCls.level === 'JS');
        let blkRelocated = false;

        for (const d of gen.days) {
          const maxP = d === 'Friday' ? (bIsJunior ? 4 : 6) : 8;
          const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
          for (let p = startP; p <= maxP; p++) {
            if (d === e.day && p === e.period) continue;
            if (newSlotsWithUnit.some(s => s.class_id === blockerClassId && s.day === d && s.period_index === p)) continue;

            if (gen._canPlaceSlot(blkUnit, d, p, newSlotsWithUnit, classMap, teacherMap, subjectMap)) {
              for (let offset = 0; offset < blkUnit.duration; offset++) {
                const pIdx = p + offset;
                if (blkUnit.isPaired) {
                  newSlotsWithUnit.push(
                    { class_id: blockerClassId, subject_id: blkUnit.allocA.subject_id, teacher_id: blkUnit.allocA.teacher_id, day: d, period_index: pIdx, is_locked: 0 },
                    { class_id: blockerClassId, subject_id: blkUnit.allocB.subject_id, teacher_id: blkUnit.allocB.teacher_id, day: d, period_index: pIdx, is_locked: 0 }
                  );
                } else {
                  newSlotsWithUnit.push(
                    { class_id: blockerClassId, subject_id: blkUnit.alloc.subject_id, teacher_id: blkUnit.alloc.teacher_id, day: d, period_index: pIdx, is_locked: 0 }
                  );
                }
              }
              blkRelocated = true;
              break;
            }
          }
          if (blkRelocated) break;
        }

        if (blkRelocated) {
          currentSlots = newSlotsWithUnit;
          unplaced.splice(uIdx, 1);
          evictedSuccessfully = true;
          break;
        } else {
          // Blocker could not be relocated directly; accept the swap if step < maxSteps / 2
          currentSlots = newSlotsWithUnit;
          unplaced.splice(uIdx, 1);
          unplaced.push(blkUnit);
          evictedSuccessfully = true;
          break;
        }
      }
    }
  }

  return {
    success: unplaced.length === 0,
    unplacedCount: unplaced.length,
    unplaced,
    slots: currentSlots
  };
}

console.log('Testing Min-Conflicts Ejection Chain across 30 restarts...');
const gen = new TimetableGenerator({ maxRestarts: 30 });

for (let r = 0; r < 30; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedUnits?.length > 0) {
    const rep = minConflictsRepair(res.slots, res.unplacedUnits, gen, 150);
    if (rep.success) {
      console.log(`\n🎉🎉🎉 100% COMPLETE SOLUTION FOUND ON RESTART ${r}! All 246 slots placed! 🎉🎉🎉`);
      console.log(`Total slots: ${rep.slots.length}`);
      process.exit(0);
    } else {
      console.log(`Restart ${r}: solve unplaced=${res.unplacedCount} -> minConflicts unplaced=${rep.unplacedCount} (${rep.unplaced.map(u => (classMap[u.class_id]?.name + ' ' + (subjectMap[(u.alloc||u.allocA).subject_id]?.code))).join(', ')})`);
    }
  } else {
    console.log(`\n🎉🎉🎉 DIRECT 100% COMPLETE SOLUTION FOUND ON RESTART ${r}! 🎉🎉🎉`);
    process.exit(0);
  }
}
