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

console.log(`Total lesson units: ${lessonUnits.length}`);

// Validation function for slot candidate
function canPlace(unit, day, period, currentSlots, teacherP8Count) {
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

  // 1. SAME CLASS CONSECUTIVE CHECK:
  // A teacher can NEVER teach > 2 consecutive periods in the same class!
  // And a class can NEVER have back-to-back double periods by the same teacher!
  if (unit.duration === 2) {
    const hasAdjacentInClass = currentSlots.some(s => 
      s.class_id === unit.class_id && 
      tIds.includes(s.teacher_id) && 
      s.day === day && 
      (s.period_index === period - 1 || s.period_index === p2 + 1)
    );
    if (hasAdjacentInClass) return false;
  } else {
    // Single period: cannot make 3 consecutive periods in the same class
    const hasBefore2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 1) &&
                       currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 2);
    const hasAfter2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 1) &&
                      currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 2);
    if (hasBefore2 || hasAfter2) return false;
  }

  // 2. TEACHER CONSTRAINTS:
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

    const isShehu = t?.time_preference === 'MORNING_ONLY' || t?.name?.includes('Shehu');

    // Anti Double-Double Chaining across all classes:
    if (unit.duration === 2) {
      const hasDoubleBefore = tDaySlots.some(s => s.period_index === period - 1) &&
                              tDaySlots.some(s => s.period_index === period - 2);
      const hasDoubleAfter = tDaySlots.some(s => s.period_index === p2 + 1) &&
                             tDaySlots.some(s => s.period_index === p2 + 2);
      if (hasDoubleBefore || hasDoubleAfter) return false;
    }

    // Universal Session Breather & Consecutive Limit:
    // In morning (P1-P4): max 3 periods for non-Shehu teachers (guarantees at least one 40-min free period)
    if (!isShehu && period <= 4) {
      const mCount = tDaySlots.filter(s => s.period_index <= 4).length;
      if (mCount + unit.duration > 3) return false;
    }
    // In afternoon (P5-P8): max 3 periods for ALL teachers (guarantees at least one 40-min free period)
    if ((p2 || period) > 4) {
      const aCount = tDaySlots.filter(s => s.period_index > 4).length;
      if (aCount + unit.duration > 3) return false;
    }

    // Strictly cap consecutive periods in a session at 3 (never 4 in a row!)
    let consecBefore = 0;
    const sessionStart = (period <= 4) ? 1 : 5;
    for (let cp = period - 1; cp >= sessionStart; cp--) {
      if (tDaySlots.some(s => s.period_index === cp)) consecBefore++;
      else break;
    }
    let consecAfter = 0;
    const sessionEnd = (period <= 4) ? 4 : maxP;
    for (let cp = (p2 || period) + 1; cp <= sessionEnd; cp++) {
      if (tDaySlots.some(s => s.period_index === cp)) consecAfter++;
      else break;
    }
    if (consecBefore + unit.duration + consecAfter > 3) {
      return false; // NEVER 4 in a row in a session!
    }

    // PERIOD 8 FAIR ROTATION CAP:
    if (period === 8 || p2 === 8) {
      const currentP8Count = (teacherP8Count && teacherP8Count[tId]) || 
                             currentSlots.filter(s => s.teacher_id === tId && s.period_index === 8).length;
      
      // Strict cap: M. Sumayya max 2 Period 8 slots in the entire week!
      if (t?.name?.includes('Sumayya') && currentP8Count >= 2) return false;
      // All other teachers: max 3 Period 8 slots in the entire week!
      if (currentP8Count >= 3) return false;
    }
  }

  // 3. SUBJECT & PERIOD 8 RESTRICTIONS:
  for (const sId of sIds) {
    const sub = subjectMap[sId];
    const code = (sub?.code || '').toUpperCase();

    if (code === 'CHM' && (period === 8 || p2 === 8)) return false;
    if (code === 'MTH' && (period >= 7 || (p2 && p2 >= 7) || (day === 'Friday' && period >= 5))) return false;
    if (code === 'ENG' && (period >= 8 || (p2 && p2 >= 8) || (day === 'Friday' && period >= 5))) return false;

    // Period 8 subject eligibility:
    if (period === 8 || p2 === 8) {
      if (isJunior) {
        // In Junior classes: user explicitly requested Hausa, Computer, National Values, Business Studies (and PVS)
        if (!isJuniorLightSubject(code)) return false;
      } else {
        // In Senior classes: PHY, CHM, MTH, ENG, GOV strictly forbidden
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

console.log('canPlace function compiled successfully!');
