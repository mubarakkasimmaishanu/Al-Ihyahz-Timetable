import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

function enhancedRepair(slots, unplacedUnits, gen) {
  const currentSlots = [...slots];
  const unplaced = [...unplacedUnits];

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

    // Step 2: 1-step within-class swap
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

    for (const occ of occupiedPeriods) {
      const occUnit = convertGroupToUnit(occ.group, unit.class_id);
      const withoutOcc = currentSlots.filter(s => !occ.group.includes(s));

      for (const e of emptySlots) {
        if (e.day === occ.day && e.period === occ.period) continue;

        if (gen._canPlaceSlot(occUnit, e.day, e.period, withoutOcc, classMap, teacherMap, subjectMap)) {
          const movedGroup = occ.group.map(s => ({ ...s, day: e.day, period_index: e.period }));
          const withOccAtE = [...withoutOcc, ...movedGroup];

          if (gen._canPlaceSlot(unit, occ.day, occ.period, withOccAtE, classMap, teacherMap, subjectMap)) {
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

    // Step 3: Cross-Class Ejection Chain
    // Unit needs to go into empty slot `e` of unit.class_id.
    // If unit's teacher T is busy in another class C2 at e.day, e.period:
    // Try moving C2's slot(s) to another empty period in C2, or swap C2's slot with another period in C2!
    const uTeacherIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];

    for (const e of emptySlots) {
      // Find what's blocking unit at e.day, e.period:
      const blockingSlots = currentSlots.filter(s => uTeacherIds.includes(s.teacher_id) && s.day === e.day && s.period_index === e.period);
      if (blockingSlots.length === 0) continue; // Not blocked by teacher (maybe same subject on day or P8 rule)

      for (const blk of blockingSlots) {
        const otherClassId = blk.class_id;
        const otherClass = classMap[otherClassId];
        const otherIsJunior = otherClass && (otherClass.name?.startsWith('JS') || otherClass.level === 'JS');
        const blkGroup = getSlotGroup(currentSlots, otherClassId, e.day, e.period);
        const blkUnit = convertGroupToUnit(blkGroup, otherClassId);
        const withoutBlk = currentSlots.filter(s => !blkGroup.includes(s));

        // Find empty slots in otherClass
        const otherEmptySlots = [];
        for (const d of gen.days) {
          const maxP = d === 'Friday' ? (otherIsJunior ? 4 : 6) : 8;
          const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
          for (let p = startP; p <= maxP; p++) {
            if (!currentSlots.some(s => s.class_id === otherClassId && s.day === d && s.period_index === p)) {
              otherEmptySlots.push({ day: d, period: p });
            }
          }
        }

        // Try moving blkUnit to an empty slot in otherClass
        for (const oe of otherEmptySlots) {
          if (oe.day === e.day && oe.period === e.period) continue;

          if (gen._canPlaceSlot(blkUnit, oe.day, oe.period, withoutBlk, classMap, teacherMap, subjectMap)) {
            const movedBlkGroup = blkGroup.map(s => ({ ...s, day: oe.day, period_index: oe.period }));
            const withBlkMoved = [...withoutBlk, ...movedBlkGroup];

            if (gen._canPlaceSlot(unit, e.day, e.period, withBlkMoved, classMap, teacherMap, subjectMap)) {
              // Success! Apply cross-class move
              for (const s of blkGroup) {
                s.day = oe.day;
                s.period_index = oe.period;
              }
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

console.log('Testing Enhanced Cross-Class Repair across 40 restarts...');
const gen = new TimetableGenerator({ maxRestarts: 40 });

for (let r = 0; r < 40; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedUnits?.length > 0) {
    const rep = enhancedRepair(res.slots, res.unplacedUnits, gen);
    if (rep.success) {
      console.log(`\n🎉🎉🎉 100% COMPLETE SOLUTION FOUND ON RESTART ${r}! All 246 slots placed! 🎉🎉🎉`);
      process.exit(0);
    } else {
      console.log(`Restart ${r}: solve unplaced=${res.unplacedCount} -> after repair unplaced=${rep.unplacedCount} (${rep.unplaced.map(u => (classMap[u.class_id]?.name + ' ' + (subjectMap[(u.alloc||u.allocA).subject_id]?.code))).join(', ')})`);
    }
  } else {
    console.log(`\n🎉🎉🎉 DIRECT 100% COMPLETE SOLUTION FOUND ON RESTART ${r}! 🎉🎉🎉`);
    process.exit(0);
  }
}
