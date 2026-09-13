import { db } from './db/database.js';

const PAIRED_SUBJECT_PAIRS = [
  ['GOV', 'PHY'],
  ['CHM', 'ECO'],
  ['BIO', 'LIT']
];

const HEAVY_SUBJECT_CODES = new Set(['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO']);

function isHeavySubject(code, name) {
  const c = (code || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return HEAVY_SUBJECT_CODES.has(c) || 
         c === 'GOVT' || c === 'CHEM' || c === 'ECON' || c === 'MATHS' ||
         n.includes('MATH') || n.includes('PHYSIC') || n.includes('CHEM') || 
         n.includes('BIOL') || n.includes('GOVERN') || n.includes('LITERAT') || n.includes('ECON');
}

const JUNIOR_LIGHT_SUBJECT_CODES = new Set(['HAUSA', 'CMP', 'COMP', 'NV', 'BUS', 'PVS']);

function isJuniorLightSubject(code) {
  const c = (code || '').toUpperCase();
  return JUNIOR_LIGHT_SUBJECT_CODES.has(c);
}

const SENIOR_BANNED_P8_CODES = new Set(['PHY', 'CHM', 'CHEM', 'MTH', 'MATHS', 'ENG', 'GOV', 'GOVT']);

// Load DB entities
const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

for (const t of teachers) {
  let unav = [];
  try { unav = JSON.parse(t.unavailable_days || '[]'); } catch { unav = (t.unavailable_days || '').split(','); }
  t.unavDays = new Set(unav);
}

// Build lesson units
const classAllocs = {};
for (const a of allocations) {
  if (!classAllocs[a.class_id]) classAllocs[a.class_id] = [];
  classAllocs[a.class_id].push(a);
}

const lessonUnits = [];
const usedAllocIds = new Set();

for (const [classId, allocList] of Object.entries(classAllocs)) {
  for (const [codeA, codeB] of PAIRED_SUBJECT_PAIRS) {
    const allocA = allocList.find(a => !usedAllocIds.has(a.id) && subjectMap[a.subject_id]?.code === codeA);
    const allocB = allocList.find(a => !usedAllocIds.has(a.id) && subjectMap[a.subject_id]?.code === codeB);

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
        lessonUnits.push({
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
        lessonUnits.push({
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

for (const alloc of allocations) {
  if (usedAllocIds.has(alloc.id)) continue;
  let remaining = alloc.periods_per_week;
  const maxDoubles = typeof alloc.allow_double === 'number' ? alloc.allow_double : (alloc.allow_double ? 1 : 0);
  let doublesCreated = 0;
  while (doublesCreated < maxDoubles && remaining >= 2) {
    doublesCreated++;
    lessonUnits.push({
      isPaired: false,
      class_id: alloc.class_id,
      duration: 2,
      unitId: `${alloc.id}_d${doublesCreated}`,
      alloc
    });
    remaining -= 2;
  }
  while (remaining > 0) {
    lessonUnits.push({
      isPaired: false,
      class_id: alloc.class_id,
      duration: 1,
      unitId: `${alloc.id}_s${remaining}`,
      alloc
    });
    remaining -= 1;
  }
}

console.log(`Total lesson units: ${lessonUnits.length} (total contacts: 246)`);

// Hard check for slot placement
function canPlace(unit, day, period, currentSlots) {
  const p2 = unit.duration === 2 ? period + 1 : null;
  const maxP = day === 'Friday' ? 6 : 8;
  if (period > maxP || (p2 && p2 > maxP)) return false;

  // Assembly rule: Period 1 on Mon & Fri
  if ((day === 'Monday' || day === 'Friday') && (period === 1 || p2 === 1)) return false;

  // Break span rule
  if (day !== 'Friday' && unit.duration === 2 && period === 4) return false;
  if (day === 'Friday' && unit.duration === 2) return false;

  // Friday class bounds
  const cls = classMap[unit.class_id];
  const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
  if (day === 'Friday') {
    if (isJunior && (period > 4 || (p2 && p2 > 4))) return false;
    if (period > 6 || (p2 && p2 > 6)) return false;
  }

  // Class occupancy
  const cBusy1 = currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === period);
  const cBusy2 = p2 ? currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === p2) : false;
  if (cBusy1 || cBusy2) return false;

  const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
  const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];

  // 1. SAME CLASS CONSECUTIVE HARD CONSTRAINT:
  // A teacher can NEVER teach > 2 consecutive periods in the same class!
  // This guarantees NO DOUBLE + DOUBLE by the same teacher in any class (e.g. M. Maryam IRS double + NV double)!
  if (unit.duration === 2) {
    const hasAdjacentInClass = currentSlots.some(s => 
      s.class_id === unit.class_id && 
      tIds.includes(s.teacher_id) && 
      s.day === day && 
      (s.period_index === period - 1 || s.period_index === p2 + 1)
    );
    if (hasAdjacentInClass) return false;
  } else {
    const hasBefore2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 1) &&
                       currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 2);
    const hasAfter2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 1) &&
                      currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 2);
    if (hasBefore2 || hasAfter2) return false;
  }

  for (const tId of tIds) {
    const t = teacherMap[tId];
    if (t?.unavDays?.has(day)) return false;
    if (t?.time_preference === 'MORNING_ONLY' && (period > 6 || (p2 && p2 > 6))) return false;

    const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
    const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
    if (tBusy1 || tBusy2) return false;

    const tDaySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
    const maxDailyHard = (day === 'Friday') ? 4 : 6;
    if (tDaySlots.length + unit.duration > maxDailyHard) return false;
  }

  // Subject restrictions
  for (const sId of sIds) {
    const sub = subjectMap[sId];
    const code = (sub?.code || '').toUpperCase();

    if (code === 'CHM' && (period === 8 || p2 === 8)) return false;
    if (code === 'MTH' && (period >= 7 || (p2 && p2 >= 7) || (day === 'Friday' && period >= 5))) return false;
    if (code === 'ENG' && (period >= 8 || (p2 && p2 >= 8) || (day === 'Friday' && period >= 5))) return false;

    // PERIOD 8 SUBJECT RESTRICTION:
    if (period === 8 || p2 === 8) {
      if (isJunior) {
        if (!isJuniorLightSubject(code)) return false;
      } else {
        if (SENIOR_BANNED_P8_CODES.has(code)) return false;
      }
    }

    // Class must never have the same subject twice on the same day
    if (currentSlots.some(s => s.class_id === unit.class_id && s.subject_id === sId && s.day === day)) {
      return false;
    }
  }

  return true;
}

// Solve implementation
function attemptSolve(stochastic = false) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const classSchedule = {};
  const teacherSchedule = {};
  const teacherDayPeriodCount = {};
  const teacherPeriodCount = {};
  const teacherPeriod8Count = {};
  const classDaySubjectCount = {};
  const classDayPeriodCount = {};
  const classDayHeavyCount = {};
  const teacherBeforeBreakCount = {};
  const teacherAfterBreakCount = {};
  const teacherDayBeforeBreakCount = {};
  const teacherDayAfterBreakCount = {};

  for (const c of classes) {
    classSchedule[c.id] = {};
    classDaySubjectCount[c.id] = {};
    classDayPeriodCount[c.id] = {};
    classDayHeavyCount[c.id] = {};
    for (const d of days) {
      classSchedule[c.id][d] = {};
      classDaySubjectCount[c.id][d] = {};
      classDayPeriodCount[c.id][d] = 0;
      classDayHeavyCount[c.id][d] = 0;
    }
  }

  for (const t of teachers) {
    teacherSchedule[t.id] = {};
    teacherDayPeriodCount[t.id] = {};
    teacherPeriodCount[t.id] = {};
    teacherPeriod8Count[t.id] = 0;
    teacherBeforeBreakCount[t.id] = 0;
    teacherAfterBreakCount[t.id] = 0;
    teacherDayBeforeBreakCount[t.id] = {};
    teacherDayAfterBreakCount[t.id] = {};
    for (let p = 1; p <= 8; p++) teacherPeriodCount[t.id][p] = 0;
    for (const d of days) {
      teacherSchedule[t.id][d] = {};
      teacherDayPeriodCount[t.id][d] = 0;
      teacherDayBeforeBreakCount[t.id][d] = 0;
      teacherDayAfterBreakCount[t.id][d] = 0;
    }
  }

  const placedSlots = [];

  // Sort units by priority
  const units = [...lessonUnits];
  units.sort((a, b) => {
    const getPriority = (unit) => {
      let p = 0;
      const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
      for (const tId of tIds) {
        const t = teacherMap[tId];
        if (t?.time_preference === 'MORNING_ONLY') p += 4000;
        if (t?.unavDays?.has('Friday')) p += 3000;
      }
      if (unit.isPaired) p += 2500;
      if (unit.duration === 2) p += 1500;
      const subIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
      for (const sId of subIds) {
        const code = (subjectMap[sId]?.code || '').toUpperCase();
        if (code === 'MTH') p += 800;
        if (code === 'ENG') p += 600;
        if (code === 'CHM') p += 500;
      }
      return p;
    };
    const pA = getPriority(a) + (stochastic ? (Math.random() * 400 - 200) : 0);
    const pB = getPriority(b) + (stochastic ? (Math.random() * 400 - 200) : 0);
    return pB - pA;
  });

  const unplaced = [];

  for (const unit of units) {
    const candidates = [];
    const unitTeachers = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
    const unitSubjects = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
    const cls = classMap[unit.class_id];
    const isJuniorClass = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');

    for (const day of days) {
      if (unitTeachers.some(tId => teacherMap[tId]?.unavDays?.has(day))) continue;
      const maxP = (day === 'Friday') ? 6 : 8;

      for (let p = 1; p <= maxP; p++) {
        if (unit.duration === 2 && p >= maxP) continue;
        const p2 = unit.duration === 2 ? p + 1 : null;

        // Check hard validity
        if (!canPlace(unit, day, p, placedSlots)) continue;

        let penalty = 0;

        // Pair preferences
        let isGovPhy = false;
        let isChmEco = false;
        let isBioLit = false;
        if (unit.isPaired) {
          for (const sId of unitSubjects) {
            const code = (subjectMap[sId]?.code || '').toUpperCase();
            if (code === 'GOV' || code === 'PHY') isGovPhy = true;
            if (code === 'CHM' || code === 'ECO') isChmEco = true;
            if (code === 'BIO' || code === 'LIT') isBioLit = true;
          }
        }
        if (isGovPhy && (p > 6 || (p2 && p2 > 6))) continue;
        if (isChmEco) {
          if (p === 8 || (p2 && p2 === 8)) continue;
          if (p === 7 || (p2 && p2 === 7)) penalty += 9000;
          if (p === 5 || p === 6 || p2 === 6) penalty -= 300;
          if (day === 'Friday') penalty += 1200;
        }
        if (isBioLit) {
          if (p === 8 || (p2 && p2 === 8)) penalty += 3000;
          if (day === 'Friday') penalty += 1200;
        }

        // Light Friday for heavy subjects
        const isHeavyUnit = unit.isPaired || unitSubjects.some(sId => isHeavySubject(subjectMap[sId]?.code, subjectMap[sId]?.name));
        if (day === 'Friday' && isHeavyUnit) {
          const maxHeavyFri = isJuniorClass ? 1 : 2;
          const heavyOnFriday = classDayHeavyCount[unit.class_id]?.['Friday'] || 0;
          if (heavyOnFriday >= maxHeavyFri) continue;
          penalty += 2000;
        }

        // Teacher heuristics
        let teacherConstraintViolated = false;
        for (const tId of unitTeachers) {
          const teacher = teacherMap[tId];
          const isShehu = teacher?.time_preference === 'MORNING_ONLY' || teacher?.name?.includes('Shehu');
          const isSumayya = teacher?.name?.includes('Sumayya');

          // Daily workload
          const teacherDaily = teacherDayPeriodCount[tId][day] || 0;
          const maxDaily = (day === 'Friday') ? Math.min(teacher?.max_daily_periods || 5, 4) : Math.max(teacher?.max_daily_periods || 5, 6);
          penalty += teacherDaily * 40;
          if (teacherDaily + unit.duration > maxDaily) {
            teacherConstraintViolated = true;
            break;
          }

          // 50/50 balance
          if (isShehu) {
            if (p === 6 || p2 === 6) penalty += 120;
            else if (p === 5 || p2 === 5) penalty += 30;
          } else {
            const tBefore = teacherBeforeBreakCount[tId] || 0;
            const tAfter = teacherAfterBreakCount[tId] || 0;
            if (p <= 4) {
              if (tBefore >= tAfter) penalty += (tBefore - tAfter + unit.duration) * 50;
            } else {
              if (tAfter >= tBefore) penalty += (tAfter - tBefore + unit.duration) * 50;
            }
          }

          // Session breathers (avoid teaching 4 in a row in a session)
          const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
          const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
          if (!isShehu) {
            if (p <= 4 && dayBefore + unit.duration > 3) penalty += 4500;
            if (p > 4 && dayAfter + unit.duration > 3) penalty += 4500;

            let consecBefore = 0;
            const startCheck = (p <= 4) ? 1 : 5;
            for (let cp = p - 1; cp >= startCheck; cp--) {
              if (teacherSchedule[tId][day][cp]) consecBefore++;
              else break;
            }
            let consecAfter = 0;
            const endCheck = (p <= 4) ? 4 : maxP;
            for (let cp = (p2 || p) + 1; cp <= endCheck; cp++) {
              if (teacherSchedule[tId][day][cp]) consecAfter++;
              else break;
            }
            const sessionConsec = consecBefore + unit.duration + consecAfter;
            if (sessionConsec >= 4) {
              penalty += 15000;
            } else if (sessionConsec === 3) {
              penalty += 1500;
            }
          }

          // PERIOD 8 FAIR ROTATION SCORING
          if (p === 8 || (p2 && p2 === 8)) {
            const currentP8 = teacherPeriod8Count[tId] || 0;
            if (isSumayya && currentP8 >= 2) {
              teacherConstraintViolated = true; // Hard cap for Sumayya
              break;
            }
            if (currentP8 >= 3) {
              teacherConstraintViolated = true; // Hard cap for others
              break;
            }
            // Extreme rotation penalty so Period 8 is strictly rotated among all teachers
            penalty += currentP8 * 8000;
          }
        }
        if (teacherConstraintViolated) continue;

        // Class daily limits
        const classDaily = classDayPeriodCount[unit.class_id]?.[day] || 0;
        if (day !== 'Friday') {
          const maxDay = (day === 'Monday') ? 7 : 8;
          if (classDaily + unit.duration > maxDay) continue;
          else if (classDaily < maxDay) penalty -= 400;
        } else {
          const maxFri = isJuniorClass ? 3 : 5;
          if (classDaily + unit.duration > maxFri) continue;
          else if (classDaily < maxFri) penalty -= 6000;
        }

        // Schedule compactness
        const startPeriod = (day === 'Monday' || day === 'Friday') ? 2 : 1;
        if (p === startPeriod) {
          penalty -= 300;
        } else if (!classSchedule[unit.class_id][day][startPeriod]) {
          penalty += 8000;
        }

        // Internal gaps forbidden
        if (p > startPeriod && !classSchedule[unit.class_id][day][p - 1]) {
          let hasOccupiedEarlier = false;
          for (let k = startPeriod; k < p - 1; k++) {
            if (classSchedule[unit.class_id][day][k]) {
              hasOccupiedEarlier = true;
              break;
            }
          }
          if (hasOccupiedEarlier) penalty += 80000;
        }

        // Before break contiguity
        if (p <= 4) {
          for (let prevP = startPeriod; prevP < p; prevP++) {
            if (!classSchedule[unit.class_id][day][prevP]) penalty += 7000;
          }
        }
        // After break contiguity
        if (p >= 5) {
          for (let m = startPeriod; m <= 4; m++) {
            if (!classSchedule[unit.class_id][day][m]) penalty += 9000;
          }
          for (let prevP = 5; prevP < p; prevP++) {
            if (!classSchedule[unit.class_id][day][prevP]) penalty += 6000;
          }
        }

        if (stochastic) penalty += Math.floor(Math.random() * 15);

        candidates.push({ day, period: p, duration: unit.duration, penalty });
      }
    }

    if (candidates.length === 0) {
      unplaced.push(unit);
      continue;
    }

    candidates.sort((a, b) => a.penalty - b.penalty);
    const chosen = candidates[0];

    // Place slot(s)
    for (let offset = 0; offset < chosen.duration; offset++) {
      const periodIdx = chosen.period + offset;

      if (unit.isPaired) {
        const slotA = {
          class_id: unit.class_id,
          subject_id: unit.allocA.subject_id,
          teacher_id: unit.allocA.teacher_id,
          day: chosen.day,
          period_index: periodIdx,
          is_locked: 0
        };
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
          if (periodIdx === 8) teacherPeriod8Count[tId] = (teacherPeriod8Count[tId] || 0) + 1;
          if (periodIdx <= 4) {
            teacherBeforeBreakCount[tId]++;
            teacherDayBeforeBreakCount[tId][chosen.day]++;
          } else {
            teacherAfterBreakCount[tId]++;
            teacherDayAfterBreakCount[tId][chosen.day]++;
          }
        }

        classDayPeriodCount[unit.class_id][chosen.day]++;
        classDayHeavyCount[unit.class_id][chosen.day]++;
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
        if (periodIdx === 8) teacherPeriod8Count[unit.alloc.teacher_id] = (teacherPeriod8Count[unit.alloc.teacher_id] || 0) + 1;

        if (periodIdx <= 4) {
          teacherBeforeBreakCount[unit.alloc.teacher_id]++;
          teacherDayBeforeBreakCount[unit.alloc.teacher_id][chosen.day]++;
        } else {
          teacherAfterBreakCount[unit.alloc.teacher_id]++;
          teacherDayAfterBreakCount[unit.alloc.teacher_id][chosen.day]++;
        }

        classDayPeriodCount[unit.class_id][chosen.day]++;
        const sub = subjectMap[unit.alloc.subject_id];
        if (isHeavySubject(sub?.code, sub?.name)) {
          classDayHeavyCount[unit.class_id][chosen.day]++;
        }
        placedSlots.push(slot);
      }
    }
  }

  return {
    success: unplaced.length === 0,
    unplacedCount: unplaced.length,
    slots: placedSlots
  };
}

console.log('Testing solve passes...');
let best = null;

for (let pass = 1; pass <= 50; pass++) {
  const res = attemptSolve(pass > 1);
  if (res.success && res.slots?.length === 246) {
    console.log(`Pass #${pass}: FOUND 100% COMPLETE 246 SLOTS!`);
    best = res;
    break;
  }
}

if (best) {
  console.log('\n=== SOLVER AUDIT ===');
  // Check P8 counts
  const p8CountByTeacher = {};
  for (const s of best.slots) {
    if (s.period_index === 8) {
      const name = teacherMap[s.teacher_id].name;
      p8CountByTeacher[name] = (p8CountByTeacher[name] || 0) + 1;
    }
  }
  console.log('\nPeriod 8 Counts by Teacher:');
  console.table(p8CountByTeacher);

  // Check Junior P8 subjects
  const juniorP8 = best.slots.filter(s => {
    const c = classMap[s.class_id];
    return (c.level === 'JS' || c.name.startsWith('JS')) && s.period_index === 8;
  });
  console.log('\nJunior Period 8 Slots:');
  console.table(juniorP8.map(s => ({
    class: classMap[s.class_id].name,
    day: s.day,
    subject: subjectMap[s.subject_id].code,
    teacher: teacherMap[s.teacher_id].name
  })));

  // Check M. Maryam consecutive in any class
  const mmSlots = best.slots.filter(s => teacherMap[s.teacher_id].name.includes('Maryam'));
  let mmMaxConsecClass = 0;
  for (const c of classes) {
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      const dSlots = mmSlots.filter(s => s.class_id === c.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
      for (let i = 0; i < dSlots.length - 1; i++) {
        if (dSlots[i+1].period_index === dSlots[i].period_index + 1) {
          if (2 > mmMaxConsecClass) mmMaxConsecClass = 2;
          if (i < dSlots.length - 2 && dSlots[i+2].period_index === dSlots[i].period_index + 2) {
            mmMaxConsecClass = 3;
          }
        }
      }
    }
  }
  console.log(`M. Maryam max consecutive in same class: ${mmMaxConsecClass} (Expected: <= 2, never 3 or 4)`);
} else {
  console.log('Did not find complete solution in 50 passes.');
}
