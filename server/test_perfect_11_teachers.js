import fs from 'fs';
import { db } from 'file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/db/database.js';

let code = fs.readFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/generator.js', 'utf8');

code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');
code = code.replace('const maxFri = isJunior ? 3 : 5;', 'const maxFri = isJunior ? 1 : 5;');

// Update _canPlaceSlot: strictly eliminate 7-period days!
const oldCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;`;

const newCanPlaceTeacher = `      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;

      // Hard Cap: No teacher ever teaches > 6 periods on Mon-Thu, or > 4 on Friday!
      const maxDaily = (day === 'Friday') ? 4 : 6;
      const daySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      if (daySlots.length + unit.duration > maxDaily) return false;`;

code = code.replace(oldCanPlaceTeacher, newCanPlaceTeacher);

// Update _attemptSolve heuristics
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
              penalty += 3000; // Prefer 5 periods/day for smooth balance
            }

            // Morning & Afternoon Clustering Prevention:
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (!isShehu) {
              if (p <= 4 && dayBefore + unit.duration >= 4) {
                penalty += 4500; // Strongly penalize cramming all 4 morning periods
              }
              if (p > 4 && dayAfter + unit.duration >= 4) {
                penalty += 4500; // Strongly penalize cramming all 4 afternoon periods
              }

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
              if (totalConsec >= 4) {
                penalty += 8000 * (totalConsec - 3); // Heavily penalize 4 or more in a row!
              } else if (totalConsec === 3) {
                penalty += 1200; // Soft penalty for 3 in a row
              }
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

fs.writeFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-perfect-gen.js', code);

const { TimetableGenerator } = await import('file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/engine/test-perfect-gen.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({ maxRestarts: 200 });
console.log('Testing 100% balanced timetable with interleaved breathers for all 11 teachers...');

let found = null;
for (let pass = 1; pass <= 30; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    console.log(`Pass #${pass}: SUCCESS 240 SLOTS FOUND!`);
    found = res;
    break;
  }
}

if (found) {
  console.log('\nAudit of all 11 teachers:');
  for (const t of teachers) {
    const tSlots = found.slots.filter(s => s.teacher_id === t.id);
    const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
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
    console.log(`${t.name.padEnd(18)} (${String(tSlots.length).padStart(2)}p): Mon=${dayCounts[0]}, Tue=${dayCounts[1]}, Wed=${dayCounts[2]}, Thu=${dayCounts[3]}, Fri=${dayCounts[4]} | MaxConsec=${maxConsec}p`);
  }
}

fs.unlinkSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-perfect-gen.js');
