import fs from 'fs';
import { db } from './db/database.js';

let code = fs.readFileSync('server/engine/generator.js', 'utf8');

// 1. Enforce maxDaily and session constraints in _canPlaceSlot
const oldCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;`;

const newCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;

      const teacherObj = teacherMap[tId];
      const isShehuT = teacherObj?.time_preference === 'MORNING_ONLY' || teacherObj?.name?.includes('Shehu');
      const daySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      const maxDailyAllowed = (day === 'Friday') ? 4 : 6;
      if (daySlots.length + unit.duration > maxDailyAllowed) return false;

      if (!isShehuT) {
        if (period <= 4) {
          const mSlots = daySlots.filter(s => s.period_index <= 4);
          if (mSlots.length + unit.duration > 3) return false;
        } else {
          const aSlots = daySlots.filter(s => s.period_index > 4);
          if (aSlots.length + unit.duration > 3) return false;
        }

        // Consecutive check in session
        let cBefore = 0;
        const startCheck = (period <= 4) ? 1 : 5;
        for (let cp = period - 1; cp >= startCheck; cp--) {
          if (daySlots.some(s => s.period_index === cp)) cBefore++;
          else break;
        }
        let cAfter = 0;
        const endCheck = (period <= 4) ? 4 : maxP;
        for (let cp = (p2 || period) + 1; cp <= endCheck; cp++) {
          if (daySlots.some(s => s.period_index === cp)) cAfter++;
          else break;
        }
        if (cBefore + unit.duration + cAfter >= 4) return false;
      }`;

code = code.replace(oldCanPlaceTeacher, newCanPlaceTeacher);

// 2. In _attemptSolve, apply burnout penalties
const oldBurnoutBlock = `            // Burnout Prevention: avoid clustering too many periods on one side of break in a single day
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration > 3) {
              penalty += 350 * (dayBefore + unit.duration - 3);
            } else if (p > 4 && dayAfter + unit.duration > 3) {
              penalty += 350 * (dayAfter + unit.duration - 3);
            }`;

const newBurnoutBlock = `            // Burnout Prevention & Interleaving across ALL 11 teachers
            const tObj = teacherMap[tId];
            const isShehu = tObj?.time_preference === 'MORNING_ONLY' || tObj?.name?.includes('Shehu');
            let unav = [];
            try {
              unav = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
            } catch { unav = []; }
            const isFourDay = Array.isArray(unav) && unav.includes('Friday');

            if (isFourDay) {
              if (teacherDaily + unit.duration > 6) continue;
            } else {
              if (day === 'Friday' && teacherDaily + unit.duration > 4) continue;
              if (teacherDaily + unit.duration > 6) continue;
              if (teacherDaily + unit.duration > 5) {
                penalty += 4500 * (teacherDaily + unit.duration - 5);
              }
            }

            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (!isShehu) {
              if (p <= 4 && dayBefore + unit.duration > 3) continue;
              if (p > 4 && dayAfter + unit.duration > 3) continue;

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
              const totalConsec = cBefore + unit.duration + cAfter;
              if (totalConsec >= 4) continue;
              if (totalConsec === 3) penalty += 1200;
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

// Allow repair threshold to 12
code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');

fs.writeFileSync('server/engine/test-gen-run.js', code);

const { TimetableGenerator } = await import('./engine/test-gen-run.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('Testing generator with maxConsec <= 3 and session <= 3...');
const gen = new TimetableGenerator({ maxRestarts: 100 });

let found = null;
for (let pass = 1; pass <= 30; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    console.log(`\nFound 240 slots on pass #${pass}!`);
    found = res;
    break;
  } else {
    process.stdout.write(`[${pass}: ${res.unplacedCount || res.gaps || 'err'}] `);
  }
}

if (found) {
  console.log('\n=== AUDIT OF ALL 11 TEACHERS ===');
  for (const t of teachers) {
    const tSlots = found.slots.filter(s => s.teacher_id === t.id);
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
  console.log('\nNo solution found in 30 passes.');
}

fs.unlinkSync('server/engine/test-gen-run.js');
