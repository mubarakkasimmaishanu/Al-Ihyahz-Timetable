import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

function improvedRepair(slots, unplacedUnits, gen) {
  const currentSlots = [...slots];
  const unplaced = [...unplacedUnits];

  for (let uIdx = unplaced.length - 1; uIdx >= 0; uIdx--) {
    const unit = unplaced[uIdx];
    const cls = classMap[unit.class_id];
    const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
    let unitPlaced = false;

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

    // 1. Direct placement
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

    // 2. 1-step swap: Group class slots by (day, period)
    for (const e of emptySlots) {
      const periodGroups = {};
      for (const s of currentSlots) {
        if (s.class_id === unit.class_id) {
          const key = s.day + '_' + s.period_index;
          if (!periodGroups[key]) periodGroups[key] = [];
          periodGroups[key].push(s);
        }
      }

      for (const [key, group] of Object.entries(periodGroups)) {
        const exDay = group[0].day;
        const exPeriod = group[0].period_index;

        if (exDay === e.day && exPeriod === e.period) continue;

        let existingUnit;
        if (group.length === 2) {
          existingUnit = {
            class_id: unit.class_id,
            duration: 1,
            isPaired: true,
            allocA: { subject_id: group[0].subject_id, teacher_id: group[0].teacher_id, class_id: unit.class_id },
            allocB: { subject_id: group[1].subject_id, teacher_id: group[1].teacher_id, class_id: unit.class_id }
          };
        } else if (group.length === 1) {
          existingUnit = {
            class_id: unit.class_id,
            duration: 1,
            isPaired: false,
            alloc: { subject_id: group[0].subject_id, teacher_id: group[0].teacher_id, class_id: unit.class_id }
          };
        } else {
          continue;
        }

        const withoutGroup = currentSlots.filter(s => !group.includes(s));

        if (gen._canPlaceSlot(existingUnit, e.day, e.period, withoutGroup, classMap, teacherMap, subjectMap)) {
          const movedGroup = group.map(s => ({ ...s, day: e.day, period_index: e.period }));
          const withGroupAtE = [...withoutGroup, ...movedGroup];

          if (gen._canPlaceSlot(unit, exDay, exPeriod, withGroupAtE, classMap, teacherMap, subjectMap)) {
            for (const s of group) {
              s.day = e.day;
              s.period_index = e.period;
            }
            for (let offset = 0; offset < unit.duration; offset++) {
              const pIdx = exPeriod + offset;
              if (unit.isPaired) {
                currentSlots.push(
                  { class_id: unit.class_id, subject_id: unit.allocA.subject_id, teacher_id: unit.allocA.teacher_id, day: exDay, period_index: pIdx, is_locked: 0 },
                  { class_id: unit.class_id, subject_id: unit.allocB.subject_id, teacher_id: unit.allocB.teacher_id, day: exDay, period_index: pIdx, is_locked: 0 }
                );
              } else {
                currentSlots.push(
                  { class_id: unit.class_id, subject_id: unit.alloc.subject_id, teacher_id: unit.alloc.teacher_id, day: exDay, period_index: pIdx, is_locked: 0 }
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
  }

  return {
    success: unplaced.length === 0,
    unplacedCount: unplaced.length,
    unplaced,
    slots: currentSlots
  };
}

const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });
for (let r = 0; r < 20; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const oldRep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
  const newRep = improvedRepair(res.slots, res.unplacedUnits, gen);
  console.log(`Restart ${r}: solve unplaced = ${res.unplacedCount} -> oldRepair = ${oldRep.unplacedCount} -> newRepair = ${newRep.unplacedCount}`);
  if (newRep.unplacedCount === 0) {
    console.log(`>>> SOLVED 100% WITH 0 UNPLACED ON RESTART ${r}! <<<`);
    break;
  }
}
