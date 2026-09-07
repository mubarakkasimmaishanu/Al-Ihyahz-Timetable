import { db } from './db/database.js';

const classes = db.prepare('SELECT id, name FROM classes').all();
const teachers = db.prepare('SELECT id, name, code, time_preference, max_daily_periods FROM teachers').all();
const subjects = db.prepare('SELECT id, name, code FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const pairDefinitions = [
  ['GOV', 'PHY'],
  ['LIT', 'CHM']
];

function findSubjectCode(subjectId) {
  return subjectMap[subjectId]?.code;
}

// Group allocations by class
const classAllocs = {};
for (const a of allocations) {
  if (!classAllocs[a.class_id]) classAllocs[a.class_id] = [];
  classAllocs[a.class_id].push(a);
}

const allUnits = [];
const usedAllocIds = new Set();

for (const [classId, allocList] of Object.entries(classAllocs)) {
  for (const [codeA, codeB] of pairDefinitions) {
    const allocA = allocList.find(a => !usedAllocIds.has(a.id) && findSubjectCode(a.subject_id) === codeA);
    const allocB = allocList.find(a => !usedAllocIds.has(a.id) && findSubjectCode(a.subject_id) === codeB);

    if (allocA && allocB && allocA.periods_per_week === allocB.periods_per_week) {
      usedAllocIds.add(allocA.id);
      usedAllocIds.add(allocB.id);

      let remaining = allocA.periods_per_week;
      const maxDoubles = Math.min(
        typeof allocA.allow_double === 'number' ? allocA.allow_double : (allocA.allow_double ? 1 : 0),
        typeof allocB.allow_double === 'number' ? allocB.allow_double : (allocB.allow_double ? 1 : 0)
      );

      let doublesCreated = 0;
      while (doublesCreated < maxDoubles && remaining >= 2) {
        doublesCreated++;
        allUnits.push({
          isPaired: true,
          class_id: Number(classId),
          duration: 2,
          unitId: `paired_${allocA.id}_${allocB.id}_d${doublesCreated}`,
          allocA,
          allocB
        });
        remaining -= 2;
      }

      while (remaining > 0) {
        allUnits.push({
          isPaired: true,
          class_id: Number(classId),
          duration: 1,
          unitId: `paired_${allocA.id}_${allocB.id}_s${remaining}`,
          allocA,
          allocB
        });
        remaining -= 1;
      }
    }
  }
}

// Unpaired allocations become regular units
for (const alloc of allocations) {
  if (usedAllocIds.has(alloc.id)) continue;
  let remaining = alloc.periods_per_week;
  const maxDoubles = typeof alloc.allow_double === 'number' ? alloc.allow_double : (alloc.allow_double ? 1 : 0);
  let doublesCreated = 0;
  while (doublesCreated < maxDoubles && remaining >= 2) {
    doublesCreated++;
    allUnits.push({
      isPaired: false,
      class_id: alloc.class_id,
      duration: 2,
      unitId: `${alloc.id}_d${doublesCreated}`,
      alloc
    });
    remaining -= 2;
  }
  while (remaining > 0) {
    allUnits.push({
      isPaired: false,
      class_id: alloc.class_id,
      duration: 1,
      unitId: `${alloc.id}_s${remaining}`,
      alloc
    });
    remaining -= 1;
  }
}

// Sort by MRV:
// 1. Paired units involving MORNING_ONLY teachers (e.g. PHY/GOV with M. Shehu)
// 2. Regular units with MORNING_ONLY teachers
// 3. Other paired units (LIT/CHM)
// 4. Doubles before singles
allUnits.sort((a, b) => {
  const isMorningOnly = (unit) => {
    if (unit.isPaired) {
      const tA = teacherMap[unit.allocA.teacher_id];
      const tB = teacherMap[unit.allocB.teacher_id];
      return (tA?.time_preference === 'MORNING_ONLY' || tB?.time_preference === 'MORNING_ONLY') ? 1 : 0;
    }
    const t = teacherMap[unit.alloc.teacher_id];
    return t?.time_preference === 'MORNING_ONLY' ? 1 : 0;
  };

  const mA = isMorningOnly(a);
  const mB = isMorningOnly(b);
  if (mB !== mA) return mB - mA;

  // Paired units first
  const pA = a.isPaired ? 1 : 0;
  const pB = b.isPaired ? 1 : 0;
  if (pB !== pA) return pB - pA;

  if (b.duration !== a.duration) return b.duration - a.duration;
  return a.class_id - b.class_id;
});

console.log(`Ready to solve ${allUnits.length} total units...`);

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const regularPeriods = 8;
const fridayPeriods = 5;

function attemptSolve(units, stochastic = false) {
  const classSchedule = {};
  const teacherSchedule = {};
  const classDaySubjectCount = {};
  const teacherDayPeriodCount = {};
  const teacherPeriodCount = {};
  const classDayPeriodCount = {};
  const teacherBeforeBreakCount = {};
  const teacherAfterBreakCount = {};
  const classBeforeBreakCount = {};
  const classAfterBreakCount = {};

  for (const c of classes) {
    classSchedule[c.id] = {};
    classDaySubjectCount[c.id] = {};
    classDayPeriodCount[c.id] = {};
    classBeforeBreakCount[c.id] = 0;
    classAfterBreakCount[c.id] = 0;
    for (const d of days) {
      classSchedule[c.id][d] = {};
      classDaySubjectCount[c.id][d] = {};
      classDayPeriodCount[c.id][d] = 0;
    }
  }

  for (const t of teachers) {
    teacherSchedule[t.id] = {};
    teacherDayPeriodCount[t.id] = {};
    teacherPeriodCount[t.id] = {};
    teacherBeforeBreakCount[t.id] = 0;
    teacherAfterBreakCount[t.id] = 0;
    for (let p = 1; p <= regularPeriods; p++) teacherPeriodCount[t.id][p] = 0;
    for (const d of days) {
      teacherSchedule[t.id][d] = {};
      teacherDayPeriodCount[t.id][d] = 0;
    }
  }

  const placedSlots = [];

  for (const unit of units) {
    const candidates = [];
    const unitTeachers = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
    const unitSubjects = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];

    for (const day of days) {
      const maxP = day === 'Friday' ? fridayPeriods : regularPeriods;

      for (let p = 1; p <= maxP; p++) {
        if (unit.duration === 2 && p >= maxP) continue;
        const p2 = unit.duration === 2 ? p + 1 : null;

        // 1. Check class free
        const cFree1 = !classSchedule[unit.class_id][day][p];
        const cFree2 = p2 ? !classSchedule[unit.class_id][day][p2] : true;
        if (!cFree1 || !cFree2) continue;

        // 2. Check all teachers free
        let allTeachersFree = true;
        for (const tId of unitTeachers) {
          const tFree1 = !teacherSchedule[tId][day][p];
          const tFree2 = p2 ? !teacherSchedule[tId][day][p2] : true;
          if (!tFree1 || !tFree2) {
            allTeachersFree = false;
            break;
          }
        }
        if (!allTeachersFree) continue;

        // Hard rule: double period cannot span break (p === 4)
        if (unit.duration === 2 && p === 4) continue;

        // Penalty calculation
        let penalty = 0;

        for (const tId of unitTeachers) {
          const teacher = teacherMap[tId];
          if (teacher && teacher.time_preference === 'MORNING_ONLY') {
            if (p > 5 || (p2 && p2 > 5)) {
              penalty += 1500 * (p - 4);
            } else if (p === 5) {
              penalty += 50;
            }
          } else {
            // 50/50 balance across before and after break
            const tBefore = teacherBeforeBreakCount[tId] || 0;
            const tAfter = teacherAfterBreakCount[tId] || 0;
            const isMorning = p <= 4;
            if (isMorning && tBefore >= tAfter) {
              penalty += (tBefore - tAfter + unit.duration) * 50;
            } else if (!isMorning && tAfter >= tBefore) {
              penalty += (tAfter - tBefore + unit.duration) * 50;
            }

            const countAtP1 = teacherPeriodCount[tId]?.[p] || 0;
            const countAtP2 = p2 ? (teacherPeriodCount[tId]?.[p2] || 0) : 0;
            penalty += (countAtP1 + countAtP2) * 10;
          }

          // Teacher daily workload balancing
          const teacherDaily = teacherDayPeriodCount[tId][day] || 0;
          const maxDaily = teacher?.max_daily_periods || 5;
          penalty += teacherDaily * 25;
          if (teacherDaily + unit.duration > maxDaily) {
            penalty += 80 * (teacherDaily + unit.duration - maxDaily);
          }
        }

        // Avoid clustering same subject on same day in class
        for (const sId of unitSubjects) {
          const exCount = classDaySubjectCount[unit.class_id][day][sId] || 0;
          if (exCount > 0) penalty += 80;
        }

        // Class load balancing
        const classDaily = classDayPeriodCount[unit.class_id]?.[day] || 0;
        penalty += classDaily * 10;

        if (stochastic) {
          penalty += Math.floor(Math.random() * 10);
        }

        candidates.push({ day, period: p, duration: unit.duration, penalty });
      }
    }

    if (candidates.length === 0) {
      return { success: false, unplacedUnit: unit, placedSlots };
    }

    candidates.sort((a, b) => a.penalty - b.penalty);
    const chosen = candidates[0];

    // Place slot(s)
    for (let offset = 0; offset < chosen.duration; offset++) {
      const periodIdx = chosen.period + offset;

      if (unit.isPaired) {
        // Place slot A
        const slotA = {
          class_id: unit.class_id,
          subject_id: unit.allocA.subject_id,
          teacher_id: unit.allocA.teacher_id,
          day: chosen.day,
          period_index: periodIdx,
          is_locked: 0
        };
        // Place slot B
        const slotB = {
          class_id: unit.class_id,
          subject_id: unit.allocB.subject_id,
          teacher_id: unit.allocB.teacher_id,
          day: chosen.day,
          period_index: periodIdx,
          is_locked: 0
        };

        classSchedule[unit.class_id][chosen.day][periodIdx] = [slotA, slotB];
        teacherSchedule[unit.allocA.teacher_id][chosen.day][periodIdx] = slotA;
        teacherSchedule[unit.allocB.teacher_id][chosen.day][periodIdx] = slotB;

        classDaySubjectCount[unit.class_id][chosen.day][unit.allocA.subject_id] = 
          (classDaySubjectCount[unit.class_id][chosen.day][unit.allocA.subject_id] || 0) + 1;
        classDaySubjectCount[unit.class_id][chosen.day][unit.allocB.subject_id] = 
          (classDaySubjectCount[unit.class_id][chosen.day][unit.allocB.subject_id] || 0) + 1;

        for (const tId of [unit.allocA.teacher_id, unit.allocB.teacher_id]) {
          teacherDayPeriodCount[tId][chosen.day]++;
          teacherPeriodCount[tId][periodIdx] = (teacherPeriodCount[tId][periodIdx] || 0) + 1;
          if (periodIdx <= 4) {
            teacherBeforeBreakCount[tId] = (teacherBeforeBreakCount[tId] || 0) + 1;
          } else {
            teacherAfterBreakCount[tId] = (teacherAfterBreakCount[tId] || 0) + 1;
          }
        }

        classDayPeriodCount[unit.class_id][chosen.day] = (classDayPeriodCount[unit.class_id][chosen.day] || 0) + 1;
        if (periodIdx <= 4) {
          classBeforeBreakCount[unit.class_id] = (classBeforeBreakCount[unit.class_id] || 0) + 1;
        } else {
          classAfterBreakCount[unit.class_id] = (classAfterBreakCount[unit.class_id] || 0) + 1;
        }

        placedSlots.push(slotA, slotB);
      } else {
        const slot = {
          class_id: unit.class_id,
          subject_id: unit.alloc.subject_id,
          teacher_id: unit.alloc.teacher_id,
          day: chosen.day,
          period_index: periodIdx,
          is_locked: 0
        };

        classSchedule[unit.class_id][chosen.day][periodIdx] = [slot];
        teacherSchedule[unit.alloc.teacher_id][chosen.day][periodIdx] = slot;
        classDaySubjectCount[unit.class_id][chosen.day][unit.alloc.subject_id] = 
          (classDaySubjectCount[unit.class_id][chosen.day][unit.alloc.subject_id] || 0) + 1;

        teacherDayPeriodCount[unit.alloc.teacher_id][chosen.day]++;
        teacherPeriodCount[unit.alloc.teacher_id][periodIdx] = 
          (teacherPeriodCount[unit.alloc.teacher_id][periodIdx] || 0) + 1;

        if (periodIdx <= 4) {
          teacherBeforeBreakCount[unit.alloc.teacher_id] = (teacherBeforeBreakCount[unit.alloc.teacher_id] || 0) + 1;
          classBeforeBreakCount[unit.class_id] = (classBeforeBreakCount[unit.class_id] || 0) + 1;
        } else {
          teacherAfterBreakCount[unit.alloc.teacher_id] = (teacherAfterBreakCount[unit.alloc.teacher_id] || 0) + 1;
          classAfterBreakCount[unit.class_id] = (classAfterBreakCount[unit.class_id] || 0) + 1;
        }

        classDayPeriodCount[unit.class_id][chosen.day] = (classDayPeriodCount[unit.class_id][chosen.day] || 0) + 1;
        placedSlots.push(slot);
      }
    }
  }

  return { success: true, placedSlots };
}

let result = null;
for (let attempt = 0; attempt < 30; attempt++) {
  result = attemptSolve(allUnits, attempt > 0);
  if (result.success) {
    console.log(`Solved successfully on attempt ${attempt + 1}! Total slots: ${result.placedSlots.length}`);
    break;
  }
}

if (result && result.success) {
  console.log('\n--- TEACHER BREAKDOWN ---');
  for (const t of teachers) {
    const tSlots = result.placedSlots.filter(s => s.teacher_id === t.id);
    const before = tSlots.filter(s => s.period_index <= 4);
    const after = tSlots.filter(s => s.period_index > 4);
    console.log(`Teacher: ${t.name} (${t.code}) | Preference: ${t.time_preference}`);
    console.log(`   Total: ${tSlots.length} periods`);
    console.log(`   Before Break (P1-4): ${before.length} (${Math.round(before.length / tSlots.length * 100)}%)`);
    console.log(`   After Break  (P5-8): ${after.length} (${Math.round(after.length / tSlots.length * 100)}%)`);

    // Day distribution
    const dayCounts = days.map(d => `${d.slice(0, 3)}: ${tSlots.filter(s => s.day === d).length}`).join(', ');
    console.log(`   Daily load: ${dayCounts}`);
  }

  console.log('\n--- PAIRED ALIGNMENT VERIFICATION ---');
  for (const className of ['SS 1', 'SS 2', 'SS 3']) {
    const cls = classes.find(c => c.name === className);
    const cSlots = result.placedSlots.filter(s => s.class_id === cls.id);
    
    // Check Gov and Phy
    const govSlots = cSlots.filter(s => findSubjectCode(s.subject_id) === 'GOV');
    const phySlots = cSlots.filter(s => findSubjectCode(s.subject_id) === 'PHY');
    console.log(`\n${className} Government (${govSlots.length} slots) vs Physics (${phySlots.length} slots):`);
    for (const g of govSlots) {
      const match = phySlots.find(p => p.day === g.day && p.period_index === g.period_index);
      console.log(`   ${g.day} P${g.period_index}: GOV (${teacherMap[g.teacher_id].code}) paired with ${match ? 'PHY (' + teacherMap[match.teacher_id].code + ')' : 'MISSING!'}`);
    }

    // Check Lit and Chem
    const litSlots = cSlots.filter(s => findSubjectCode(s.subject_id) === 'LIT');
    const chmSlots = cSlots.filter(s => findSubjectCode(s.subject_id) === 'CHM');
    console.log(`\n${className} Literature (${litSlots.length} slots) vs Chemistry (${chmSlots.length} slots):`);
    for (const l of litSlots) {
      const match = chmSlots.find(c => c.day === l.day && c.period_index === l.period_index);
      console.log(`   ${l.day} P${l.period_index}: LIT (${teacherMap[l.teacher_id].code}) paired with ${match ? 'CHM (' + teacherMap[match.teacher_id].code + ')' : 'MISSING!'}`);
    }
  }
} else {
  console.error('Failed to solve:', result?.unplacedUnit);
}
