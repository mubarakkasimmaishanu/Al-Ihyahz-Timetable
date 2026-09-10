import { db } from './db/database.js';

const PAIRED_SUBJECT_PAIRS = [
  ['GOV', 'PHY'],
  ['CHM', 'ECO'],
  ['BIO', 'LIT']
];

const HEAVY_SUBJECT_CODES = new Set(['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO']);

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

// Extract teacher unavailable days
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

console.log(`Loaded ${lessonUnits.length} lesson units.`);

// Days and valid periods for each class
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Let's test a randomized greedy restart solver with strict constraints
function solveOnce() {
  const classSchedule = {};
  const teacherSchedule = {};
  const classDaySubject = {};
  const teacherDayPeriodCount = {};

  for (const c of classes) {
    classSchedule[c.id] = {};
    classDaySubject[c.id] = {};
    for (const d of days) {
      classSchedule[c.id][d] = {};
      classDaySubject[c.id][d] = {};
    }
  }

  for (const t of teachers) {
    teacherSchedule[t.id] = {};
    teacherDayPeriodCount[t.id] = {};
    for (const d of days) {
      teacherSchedule[t.id][d] = {};
      teacherDayPeriodCount[t.id][d] = 0;
    }
  }

  // Define allowed periods per class and day:
  // Friday: strictly P1–P4 for ALL classes.
  // Mon–Thu:
  // - SS 1–3: P1–P8 (all periods allowed)
  // - JS 2: P1–P7 (P8 strictly forbidden)
  // - JS 1, JS 3: P1–P7 (P8 strictly forbidden, P7 only on 1-2 days)
  
  // Sort units:
  // 1. M. Shehu units (most constrained: 22 periods in Mon-Thu P1-P6)
  // 2. M. Zainab Kabir units (24 periods in Mon-Thu)
  // 3. Paired units
  // 4. Doubles before singles
  const units = [...lessonUnits];
  units.sort((a, b) => {
    const getTeacherIds = (u) => u.isPaired ? [u.allocA.teacher_id, u.allocB.teacher_id] : [u.alloc.teacher_id];
    const hasShehu = (u) => getTeacherIds(u).some(id => teacherMap[id]?.name?.includes('Shehu')) ? 1 : 0;
    const hasZainab = (u) => getTeacherIds(u).some(id => teacherMap[id]?.name?.includes('Zainab')) ? 1 : 0;
    
    if (hasShehu(b) !== hasShehu(a)) return hasShehu(b) - hasShehu(a);
    if (hasZainab(b) !== hasZainab(a)) return hasZainab(b) - hasZainab(a);
    if ((b.isPaired ? 1 : 0) !== (a.isPaired ? 1 : 0)) return (b.isPaired ? 1 : 0) - (a.isPaired ? 1 : 0);
    if (b.duration !== a.duration) return b.duration - a.duration;
    return Math.random() - 0.5;
  });

  const placedUnits = [];

  for (const unit of units) {
    const uTeachers = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
    const uSubjects = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
    const cls = classMap[unit.class_id];
    const isJunior = cls.level === 'JS' || cls.name.startsWith('JS');

    const candidates = [];

    for (const day of days) {
      // Teacher unavailable on this day
      if (uTeachers.some(tId => teacherMap[tId].unavDays.has(day))) continue;

      const maxP = (day === 'Friday') ? 4 : (isJunior ? 7 : 8);

      for (let p = 1; p <= maxP - unit.duration + 1; p++) {
        const p2 = unit.duration === 2 ? p + 1 : null;

        // No double across break
        if (unit.duration === 2 && p === 4) continue;
        // No double on Friday
        if (day === 'Friday' && unit.duration === 2) continue;

        // Class free
        if (classSchedule[unit.class_id][day][p] || (p2 && classSchedule[unit.class_id][day][p2])) continue;

        // Teachers free
        let tBusy = false;
        for (const tId of uTeachers) {
          if (teacherSchedule[tId][day][p] || (p2 && teacherSchedule[tId][day][p2])) {
            tBusy = true;
            break;
          }
          // Shehu morning only (P1-P6)
          if (teacherMap[tId].name?.includes('Shehu') && (p > 6 || (p2 && p2 > 6))) {
            tBusy = true;
            break;
          }
        }
        if (tBusy) continue;

        // Subject repetition: max 2 periods on same day, and max 1 on Friday
        let sClash = false;
        for (const sId of uSubjects) {
          const cur = classDaySubject[unit.class_id][day][sId] || 0;
          if (cur + unit.duration > 2) { sClash = true; break; }
          if (day === 'Friday' && cur + unit.duration > 1) { sClash = true; break; }
        }
        if (sClash) continue;

        // Core subject rules:
        // Math never P7/P8 on Mon-Thu, never P5/P6 on Fri
        const isMath = uSubjects.some(sId => subjectMap[sId]?.code === 'MTH');
        if (isMath && (p >= 7 || (p2 && p2 >= 7))) continue;

        // English never P8 on Mon-Thu
        const isEng = uSubjects.some(sId => subjectMap[sId]?.code === 'ENG');
        if (isEng && (p >= 8 || (p2 && p2 >= 8))) continue;

        // Heuristic penalty:
        let penalty = 0;

        // Encourage filling morning (P1-P4) first!
        if (p <= 4) {
          penalty -= 1000;
        } else {
          // Afternoon: count empty morning periods
          let emptyMorning = 0;
          for (let m = 1; m <= 4; m++) {
            if (!classSchedule[unit.class_id][day][m]) emptyMorning++;
          }
          penalty += emptyMorning * 5000;
        }

        // Friday bonus if Friday has < 4 periods
        if (day === 'Friday') {
          const friSlots = Object.keys(classSchedule[unit.class_id]['Friday']).length;
          if (friSlots < 4) penalty -= 800;
        }

        // Favor earlier periods
        penalty += p * 50;

        // Teacher daily load balance
        for (const tId of uTeachers) {
          penalty += (teacherDayPeriodCount[tId][day] || 0) * 100;
        }

        penalty += Math.random() * 20;

        candidates.push({ day, period: p, duration: unit.duration, penalty });
      }
    }

    if (candidates.length === 0) {
      return { success: false, placed: placedUnits.length, total: units.length };
    }

    candidates.sort((a, b) => a.penalty - b.penalty);
    const chosen = candidates[0];

    for (let off = 0; off < chosen.duration; off++) {
      const pIdx = chosen.period + off;
      classSchedule[unit.class_id][chosen.day][pIdx] = unit;
      for (const tId of uTeachers) {
        teacherSchedule[tId][chosen.day][pIdx] = unit;
        teacherDayPeriodCount[tId][chosen.day]++;
      }
      for (const sId of uSubjects) {
        classDaySubject[unit.class_id][chosen.day][sId] = (classDaySubject[unit.class_id][chosen.day][sId] || 0) + 1;
      }
    }

    placedUnits.push({ unit, chosen });
  }

  return { success: true, placed: placedUnits.length, total: units.length, classSchedule, teacherSchedule, placedUnits };
}

console.log('Running test solve loops...');
let attempts = 0;
let best = null;
const start = Date.now();
while (attempts < 200) {
  attempts++;
  const res = solveOnce();
  if (res.success) {
    best = res;
    console.log(`FOUND PERFECT SOLUTION on attempt #${attempts} in ${(Date.now() - start)}ms!`);
    break;
  }
}

if (best) {
  console.log('=== Checking Friday layout for all classes ===');
  for (const c of classes) {
    let fri = (c.name + ' Fri: ').padEnd(12);
    for (let p = 1; p <= 4; p++) {
      const u = best.classSchedule[c.id]['Friday'][p];
      fri += `P${p}:[` + (u ? (u.isPaired ? 'PAIR' : subjectMap[u.alloc.subject_id].code) : 'FREE') + '] ';
    }
    console.log(fri);
  }

  console.log('=== Checking Morning Periods (P1-P4) for Mon-Thu ===');
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday']) {
    console.log(`Day: ${d}`);
    for (const c of classes) {
      let row = (c.name + ': ').padEnd(10);
      for (let p = 1; p <= 8; p++) {
        const u = best.classSchedule[c.id][d][p];
        row += `P${p}:[` + (u ? (u.isPaired ? 'PAIR' : subjectMap[u.alloc.subject_id].code) : 'FREE') + '] ';
      }
      console.log(row);
    }
  }
} else {
  console.log(`Could not find 100% solution in ${attempts} attempts.`);
}
