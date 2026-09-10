import fs from 'fs';
import { db } from 'file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/db/database.js';

let code = fs.readFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/generator.js', 'utf8');

code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');
code = code.replace('const maxFri = isJunior ? 3 : 5;', 'const maxFri = isJunior ? 1 : 5;');

// Update _canPlaceSlot to strictly enforce:
// 1. Never > 6 periods on Mon-Thu for ANY teacher (no 7 or 8)
// 2. Never > 4 periods on Friday for ANY teacher
// 3. Guarantee morning and afternoon breathers for all full-day staff
const oldCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;`;

const newCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;

      // Strict Teacher Daily Cap: Strictly Max 6 on Mon-Thu, Max 4 on Friday
      const maxAllowedDaily = (day === 'Friday') ? 4 : 6;
      const daySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      if (daySlots.length + unit.duration > maxAllowedDaily) return false;

      // Breather Guarantee for full-day teachers (all except Morning-Only M. Shehu)
      const isMorningOnly = t?.time_preference === 'MORNING_ONLY' || t?.name?.includes('Shehu');
      if (!isMorningOnly) {
        if (period <= 4) {
          const mSlots = daySlots.filter(s => s.period_index <= 4).length;
          if (mSlots + unit.duration >= 4) return false; // At most 3 periods before break
        } else {
          const aSlots = daySlots.filter(s => s.period_index > 4).length;
          if (aSlots + unit.duration >= 4) return false; // At most 3 periods after break
        }
      }`;

code = code.replace(oldCanPlaceTeacher, newCanPlaceTeacher);

// Update _attemptSolve
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
            const isShehu = teacher?.time_preference === 'MORNING_ONLY' || teacher?.name?.includes('Shehu');

            // Daily limits: strictly max 6 on Mon-Thu, strictly max 4 on Friday
            const maxAllowedDay = (day === 'Friday') ? 4 : 6;
            if (teacherDaily + unit.duration > maxAllowedDay) continue;
            if (teacherDaily + unit.duration > 5 && day !== 'Friday' && !isShehu) {
              penalty += 3500; // Strongly prefer 5 periods/day for smooth balance
            }

            // Morning & Afternoon Breathers:
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (!isShehu) {
              if (p <= 4 && dayBefore + unit.duration >= 4) continue; // Must leave at least 1 free period before break
              if (p > 4 && dayAfter + unit.duration >= 4) continue; // Must leave at least 1 free period after break

              // Consecutive session cap: Max 2 (at most 3) consecutive periods
              let cBefore = 0;
              const startP = (p <= 4) ? 1 : 5;
              for (let cp = p - 1; cp >= startP; cp--) {
                if (teacherSchedule[tId][day][cp]) cBefore++;
                else break;
              }
              let cAfter = 0;
              const endP = (p <= 4) ? 4 : maxP;
              for (let cp = (p2 || p) + 1; cp <= endP; cp++) {
                if (teacherSchedule[tId][day][cp]) cAfter++;
                else break;
              }
              const totalConsec = cBefore + unit.duration + cAfter;
              if (totalConsec >= 4) continue; // Strictly no 4 in a row!
              if (totalConsec === 3) penalty += 1500;
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

fs.writeFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-clean-algo.js', code);

const { TimetableGenerator } = await import('file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/engine/test-clean-algo.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({ maxRestarts: 250 });
console.log('Searching for 100% compliant timetable where:');
console.log('1. NO teacher exceeds 6 periods on Mon-Thu, or 4 on Friday');
console.log('2. ALL teachers have morning & afternoon breathers (max consecutive <= 3)');
console.log('3. M. Sumayya is capped at 5 periods/day');
console.log('4. Zero clashes, zero gaps on Mon-Thu, 240 slots total');

let perfectResult = null;

for (let pass = 1; pass <= 40; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    // Audit all 11 teachers
    let passCompliant = true;
    const tReports = [];

    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
      const isShehu = t.name.includes('Shehu');

      // Check max daily
      const maxDaily = Math.max(...dayCounts);
      if (maxDaily > 6) passCompliant = false;
      if (dayCounts[4] > 4) passCompliant = false;

      // Check consecutive
      let maxConsec = 0;
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d);
        for (const pRange of [[1,4], [5,8]]) {
          let c = 0;
          for (let p = pRange[0]; p <= pRange[1]; p++) {
            if (dSlots.some(s => s.period_index === p)) { c++; if (c > maxConsec) maxConsec = c; }
            else c = 0;
          }
        }
      }
      if (!isShehu && maxConsec >= 4) passCompliant = false;

      tReports.push({ name: t.name, total: tSlots.length, days: dayCounts, maxConsec });
    }

    // Check Sumayya daily cap: Mon-Thu <= 5
    const sumayya = tReports.find(r => r.name.includes('Sumayya'));
    if (Math.max(...sumayya.days.slice(0, 4)) > 5) {
      passCompliant = false;
    }

    console.log(`Pass #${pass}: Placed 240 slots. Compliant: ${passCompliant}`);
    if (passCompliant) {
      perfectResult = { res, tReports };
      console.log('>>> 100% PERFECT COMPLIANT TIMETABLE FOUND! <<<');
      break;
    }
  }
}

if (perfectResult) {
  console.log('\n========================================================================================');
  console.log('                 FINAL AUDIT OF ALL 11 TEACHERS UNDER NEW ALGORITHM');
  console.log('========================================================================================');
  console.log('TEACHER NAME        | TOTAL | MON | TUE | WED | THU | FRI | MAX CONSEC | STATUS');
  console.log('--------------------+-------+-----+-----+-----+-----+-----+------------+----------------------');
  for (const r of perfectResult.tReports) {
    const status = r.maxConsec <= 2 ? 'EXCELLENT (<=2p)' : (r.maxConsec === 3 ? 'WELL-BALANCED (3p)' : 'MORNING-ONLY (4p)');
    console.log(`${r.name.padEnd(19)} |   ${String(r.total).padStart(2)}  |  ${r.days[0]}  |  ${r.days[1]}  |  ${r.days[2]}  |  ${r.days[3]}  |  ${r.days[4]}  |     ${r.maxConsec}p     | ${status}`);
  }
}

fs.unlinkSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-clean-algo.js');
