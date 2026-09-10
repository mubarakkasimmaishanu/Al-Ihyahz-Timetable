import fs from 'fs';
import { db } from './db/database.js';

// Read generator.js
let code = fs.readFileSync('server/engine/generator.js', 'utf8');

// 1. In _compactSchedule, ensure compacting NEVER violates teacher session cap or causes consecutive >= 4
const oldCompactTeacherBusy = `              const teacherBusy = slots.some(other =>
                other !== s &&
                other.day === day &&
                other.period_index === pEmpty &&
                other.teacher_id === s.teacher_id
              );
              if (teacherBusy) {
                canMove = false;
                break;
              }`;

const newCompactTeacherBusy = `              const teacherBusy = slots.some(other =>
                other !== s &&
                other.day === day &&
                other.period_index === pEmpty &&
                other.teacher_id === s.teacher_id
              );
              if (teacherBusy) {
                canMove = false;
                break;
              }

              // Also ensure compacting never pushes teacher into session overload (mCount >= 4 or aCount >= 4)
              const isShehu = teacher?.time_preference === 'MORNING_ONLY' || teacher?.name?.includes('Shehu');
              if (!isShehu) {
                const tSlotsDay = slots.filter(other => other !== s && other.day === day && other.teacher_id === s.teacher_id);
                if (pEmpty <= 4) {
                  const mCount = tSlotsDay.filter(other => other.period_index <= 4).length;
                  if (mCount >= 3) { canMove = false; break; }
                } else {
                  const aCount = tSlotsDay.filter(other => other.period_index > 4).length;
                  if (aCount >= 3) { canMove = false; break; }
                }
              }`;

code = code.replace(oldCompactTeacherBusy, newCompactTeacherBusy);

// 2. In _canPlaceSlot: enforce hard daily limits and session limits
const oldCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;`;

const newCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;

      const teacherObj = teacherMap[tId];
      const isShehuT = teacherObj?.time_preference === 'MORNING_ONLY' || teacherObj?.name?.includes('Shehu');
      const daySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      
      // Daily hard cap: max 6 on Mon-Thu, max 4 on Friday
      const maxDailyAllowed = (day === 'Friday') ? 4 : 6;
      if (daySlots.length + unit.duration > maxDailyAllowed) return false;

      // Session hard cap (for all except M. Shehu):
      if (!isShehuT) {
        if (period <= 4) {
          const mSlots = daySlots.filter(s => s.period_index <= 4);
          if (mSlots.length + unit.duration > 3) return false; // At least one free period in morning!
        } else {
          const aSlots = daySlots.filter(s => s.period_index > 4);
          if (aSlots.length + unit.duration > 3) return false; // At least one free period in afternoon!
        }
      }`;

code = code.replace(oldCanPlaceTeacher, newCanPlaceTeacher);

// 3. In _attemptSolve: replace the burnout heuristic block
const oldBurnoutBlock = `            // Burnout Prevention: avoid clustering too many periods on one side of break in a single day
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration > 3) {
              penalty += 350 * (dayBefore + unit.duration - 3);
            } else if (p > 4 && dayAfter + unit.duration > 3) {
              penalty += 350 * (dayAfter + unit.duration - 3);
            }`;

const newBurnoutBlock = `            // =========================================================================
            // MANDATORY BREAK INTERLEAVING & BURNOUT PREVENTION (ALL 11 TEACHERS)
            // =========================================================================
            const tObj = teacherMap[tId];
            const isShehu = tObj?.time_preference === 'MORNING_ONLY' || tObj?.name?.includes('Shehu');
            let unav = [];
            try {
              unav = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
            } catch { unav = []; }
            const isFourDay = Array.isArray(unav) && unav.includes('Friday');

            // 1. Daily Workload Limits
            if (isFourDay) {
              if (teacherDaily + unit.duration > 6) continue; // M. Zainab Kabir & M. Shehu: max 6
            } else {
              if (day === 'Friday' && teacherDaily + unit.duration > 4) continue;
              if (teacherDaily + unit.duration > 6) continue;
              if (teacherDaily + unit.duration > 5) {
                penalty += 4000 * (teacherDaily + unit.duration - 5); // Strongly favor 5 periods/day
              }
            }

            // 2. Mandatory Morning & Afternoon Breathers (for all teachers except M. Shehu)
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (!isShehu) {
              if (p <= 4 && dayBefore + unit.duration > 3) {
                continue; // GUARANTEE AT LEAST 1 FREE PERIOD IN MORNING
              }
              if (p > 4 && dayAfter + unit.duration > 3) {
                continue; // GUARANTEE AT LEAST 1 FREE PERIOD IN AFTERNOON
              }

              // 3. Consecutive Block Cap: Max 2 (at most 3) consecutive periods
              let cBefore = 0;
              const startCheck = (p <= 4) ? 1 : 5;
              for (let cp = p - 1; cp >= startCheck; cp--) {
                if (teacherSchedule[tId][day][cp]) cBefore++;
                else break;
              }
              let cAfter = 0;
              const endCheck = (p <= 4) ? 4 : maxP;
              for (let cp = (p2 || p) + 1; cp <= endCheck; cp++) {
                if (teacherSchedule[tId][day][cp]) cAfter++;
                else break;
              }
              const sessionConsec = cBefore + unit.duration + cAfter;
              if (sessionConsec >= 4) {
                continue; // Strictly forbidden to teach 4 in a row!
              } else if (sessionConsec === 3) {
                penalty += 1500; // Prefer blocks of 1 or 2 periods followed by a breather
              }
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

// Enable unplaced repair threshold to 12
code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');

fs.writeFileSync('server/engine/test-generator-balanced.js', code);

const { TimetableGenerator } = await import('./engine/test-generator-balanced.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('Testing balanced timetable generator...');
const gen = new TimetableGenerator({ maxRestarts: 100 });

let successResult = null;
for (let pass = 1; pass <= 30; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    console.log(`Pass #${pass}: 240-slot conflict-free schedule found!`);
    successResult = res;
    break;
  } else {
    process.stdout.write(`.`);
  }
}

if (successResult) {
  console.log('\n\n=== AUDIT OF ALL 11 TEACHERS ===');
  for (const t of teachers) {
    const tSlots = successResult.slots.filter(s => s.teacher_id === t.id);
    const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
    let maxSessionConsec = 0;
    let morningBreather = true;
    let afternoonBreather = true;

    for (const d of gen.days) {
      const dSlots = tSlots.filter(s => s.day === d);
      const mSlots = dSlots.filter(s => s.period_index <= 4);
      const aSlots = dSlots.filter(s => s.period_index > 4);
      if (mSlots.length >= 4) morningBreather = false;
      if (aSlots.length >= 4) afternoonBreather = false;

      let c = 0;
      for (let p = 1; p <= 4; p++) {
        if (mSlots.some(s => s.period_index === p)) { c++; if (c > maxSessionConsec) maxSessionConsec = c; }
        else c = 0;
      }
      c = 0;
      for (let p = 5; p <= 8; p++) {
        if (aSlots.some(s => s.period_index === p)) { c++; if (c > maxSessionConsec) maxSessionConsec = c; }
        else c = 0;
      }
    }

    console.log(`${t.name.padEnd(19)} | Total: ${String(tSlots.length).padStart(2)}p | Days: [${dayCounts.join(', ')}] | MaxConsec: ${maxSessionConsec}p | M-Rest: ${morningBreather} | A-Rest: ${afternoonBreather}`);
  }
} else {
  console.log('\nCould not find 240 slots in 30 passes with strict constraint.');
}

fs.unlinkSync('server/engine/test-generator-balanced.js');
