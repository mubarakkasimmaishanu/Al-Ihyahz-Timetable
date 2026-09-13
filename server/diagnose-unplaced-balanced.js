import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
console.log('Unplaced count:', res.unplacedCount);

// Test why each unplaced unit had 0 candidates during attemptSolve
console.log('\n--- DIAGNOSING WHY EACH UNIT HAD 0 CANDIDATES ---');

function explainCanPlace(unit, day, period, currentSlots, classMap, teacherMap, subjectMap, gen) {
  const p2 = unit.duration === 2 ? period + 1 : null;
  const maxP = day === 'Friday' ? gen.fridayPeriods : gen.regularPeriods;
  if (period > maxP || (p2 && p2 > maxP)) return 'exceeds_maxP';
  if ((day === 'Monday' || day === 'Friday') && (period === 1 || p2 === 1)) return 'assembly_p1';
  if (day !== 'Friday' && unit.duration === 2 && period === 4) return 'span_break';
  if (day === 'Friday' && unit.duration === 2) return 'friday_double';

  const cls = classMap[unit.class_id];
  const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
  if (day === 'Friday') {
    if (isJunior && (period > 4 || (p2 && p2 > 4))) return 'junior_friday_p_gt_4';
    if (period > 6 || (p2 && p2 > 6)) return 'senior_friday_p_gt_6';
  }

  const cBusy1 = currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === period);
  const cBusy2 = p2 ? currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === p2) : false;
  if (cBusy1 || cBusy2) return 'class_busy';

  const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
  const unitEnd = period + unit.duration - 1;

  if (unit.duration === 2) {
    const hasAdjacentInClass = currentSlots.some(s => 
      s.class_id === unit.class_id && 
      tIds.includes(s.teacher_id) && 
      s.day === day && 
      (s.period_index === period - 1 || s.period_index === unitEnd + 1)
    );
    if (hasAdjacentInClass) return 'same_class_consecutive_double';
  } else {
    const prev1 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 1);
    const prev2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period - 2);
    const next1 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 1);
    const next2 = currentSlots.some(s => s.class_id === unit.class_id && tIds.includes(s.teacher_id) && s.day === day && s.period_index === period + 2);
    if ((prev1 && prev2) || (next1 && next2) || (prev1 && next1)) return 'same_class_consecutive_single';
  }

  for (const tId of tIds) {
    const t = teacherMap[tId];
    if (t?.unavailable_days && t.unavailable_days.includes(day)) return `teacher_${t?.name}_unavailable_day_${day}`;
    if (t?.time_preference === 'MORNING_ONLY' && (period > 6 || unitEnd > 6)) return 'morning_only_teacher_p_gt_6';

    const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
    const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
    if (tBusy1 || tBusy2) return `teacher_${t?.name}_busy`;

    const tDaySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
    const maxDailyHard = (day === 'Friday') ? 4 : 6;
    if (tDaySlots.length + unit.duration > maxDailyHard) return `teacher_${t?.name}_exceed_daily_hard_${maxDailyHard}`;

    const isShehuCP = t?.time_preference === 'MORNING_ONLY' || t?.name?.includes('Shehu');
    const isMorningSpecialist = isShehuCP || t?.name?.includes('Yusuf');

    if (!isMorningSpecialist && period <= 4) {
      const mCount = tDaySlots.filter(s => s.period_index <= 4).length;
      if (mCount + unit.duration > 3) return `teacher_${t?.name}_exceed_morning_breather_3 (currently ${mCount})`;
    }
    if (!isMorningSpecialist && unitEnd > 4) {
      const aCount = tDaySlots.filter(s => s.period_index > 4).length;
      if (aCount + unit.duration > 3) return `teacher_${t?.name}_exceed_afternoon_breather_3 (currently ${aCount})`;
    }

    if (!isMorningSpecialist) {
      let consecBefore = 0;
      const sessionStart = (period <= 4) ? 1 : 5;
      for (let cp = period - 1; cp >= sessionStart; cp--) {
        if (tDaySlots.some(s => s.period_index === cp)) consecBefore++;
        else break;
      }
      let consecAfter = 0;
      const sessionEnd = (period <= 4) ? 4 : maxP;
      for (let cp = unitEnd + 1; cp <= sessionEnd; cp++) {
        if (tDaySlots.some(s => s.period_index === cp)) consecAfter++;
        else break;
      }
      if (consecBefore + unit.duration + consecAfter > 3) return `teacher_${t?.name}_session_consecutive_gt_3`;

      let dayBefore = 0;
      for (let cp = period - 1; cp >= 1; cp--) {
        if (tDaySlots.some(s => s.period_index === cp)) dayBefore++;
        else break;
      }
      let dayAfter = 0;
      for (let cp = unitEnd + 1; cp <= maxP; cp++) {
        if (tDaySlots.some(s => s.period_index === cp)) dayAfter++;
        else break;
      }
      if (dayBefore + unit.duration + dayAfter > 4) return `teacher_${t?.name}_day_consecutive_gt_4`;
    }
  }

  const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
  for (const sId of sIds) {
    const sub = subjectMap[sId];
    const code = (sub?.code || '').toUpperCase();
    if (code === 'CHM' && (period === 8 || unitEnd === 8)) return 'chm_period_8';
    if (code === 'MTH' && (period >= 7 || unitEnd >= 7 || (day === 'Friday' && period >= 5))) return 'mth_late_period';
    if (code === 'ENG' && (period >= 8 || unitEnd >= 8 || (day === 'Friday' && period >= 5))) return 'eng_late_period';

    if (period === 8 || unitEnd === 8) {
      if (isJunior) {
        if (!['HAUSA', 'CMP', 'COMP', 'NV', 'BUS'].includes(code)) return `junior_p8_not_light_${code}`;
      } else {
        if (['PHY', 'CHM', 'CHEM', 'MTH', 'MATHS', 'ENG', 'GOV', 'GOVT', 'ECO', 'ECON'].includes(code)) return `senior_p8_banned_${code}`;
      }
    }

    if (currentSlots.some(s => s.class_id === unit.class_id && s.subject_id === sId && s.day === day)) {
      return `same_subject_${code}_already_on_${day}`;
    }
  }

  return 'OK';
}

console.log('\n--- DETAILED REASONS FOR REJECTED OPEN SLOTS ---');
for (const u of res.unplacedUnits || []) {
  const cName = classMap[u.class_id]?.name;
  const tIds = u.isPaired ? [u.allocA.teacher_id, u.allocB.teacher_id] : [u.alloc.teacher_id];
  const tNames = tIds.map(id => teacherMap[id]?.name).join(' & ');
  const sIds = u.isPaired ? [u.allocA.subject_id, u.allocB.subject_id] : [u.alloc.subject_id];
  const sCodes = sIds.map(id => subjectMap[id]?.code).join(' & ');
  console.log(`\nUnit: ${u.unitId} (${cName} ${sCodes}, teacher: ${tNames})`);

  for (const d of gen.days) {
    const maxP = gen.getMaxPeriodsForDay(d);
    for (let p = 1; p <= maxP; p++) {
      const clsBusy = res.slots.some(s => s.class_id === u.class_id && s.day === d && (s.period_index === p || (u.duration === 2 && s.period_index === p + 1)));
      if (clsBusy) continue;
      const reason = explainCanPlace(u, d, p, res.slots, classMap, teacherMap, subjectMap, gen);
      console.log(`   Slot ${d} P${p}: ${reason}`);
    }
  }
}


