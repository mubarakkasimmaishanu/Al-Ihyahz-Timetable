import fs from 'fs';
import { db } from 'file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/db/database.js';

let code = fs.readFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/generator.js', 'utf8');

// Ensure repair threshold is 12 and maxFri junior is 1
code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');
code = code.replace('const maxFri = isJunior ? 3 : 5;', 'const maxFri = isJunior ? 1 : 5;');

// Replace teacher daily workload and consecutive heuristics
const oldBurnoutBlock = `            // Burnout Prevention: avoid clustering too many periods on one side of break in a single day
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration > 3) {
              penalty += 350 * (dayBefore + unit.duration - 3);
            } else if (p > 4 && dayAfter + unit.duration > 3) {
              penalty += 350 * (dayAfter + unit.duration - 3);
            }`;

const newBurnoutBlock = `            // 1. Universal Consecutive Teaching Period Cap (Burnout Prevention for all 11 Teachers)
            let consecBefore = 0;
            for (let cp = p - 1; cp >= 1; cp--) {
              if (teacherSchedule[tId][day][cp]) consecBefore++;
              else break;
            }
            let consecAfter = 0;
            for (let cp = (p2 || p) + 1; cp <= maxP; cp++) {
              if (teacherSchedule[tId][day][cp]) consecAfter++;
              else break;
            }
            const totalConsec = consecBefore + unit.duration + consecAfter;
            
            // Hard penalty for 4 or more consecutive periods (no uninterrupted blocks of 4+)
            if (totalConsec >= 4) {
              penalty += 15000 * (totalConsec - 3);
            } else if (totalConsec === 3) {
              // Soft penalty for 3 consecutive periods (prefer 1 or 2 periods followed by a break)
              penalty += 1200;
            }

            // 2. Mandatory Breather Rule (Interleaving):
            // Avoid filling all 4 periods before break (P1-P4) consecutively
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration >= 4) {
              penalty += 6000; // Force at least one free period before break
            }
            if (p > 4 && dayAfter + unit.duration >= 4) {
              penalty += 6000; // Force at least one free period after break
            }

            // 3. Daily Workload Leveling:
            // For teachers available 5 days (e.g. M. Sumayya), cap Mon-Thu at max 5 periods/day (Fri max 4)
            const tObj = teacherMap[tId];
            let unav = [];
            try {
              unav = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
            } catch { unav = []; }
            const isFourDayTeacher = Array.isArray(unav) && unav.includes('Friday');

            if (!isFourDayTeacher) {
              const maxAllowedDay = (day === 'Friday') ? 4 : 5;
              if (teacherDaily + unit.duration > maxAllowedDay) {
                penalty += 10000 * (teacherDaily + unit.duration - maxAllowedDay);
              }
            } else {
              // 4-day teachers (M. Shehu, M. Zainab Kabir): max 6 periods/day
              if (teacherDaily + unit.duration > 6) {
                penalty += 15000 * (teacherDaily + unit.duration - 6);
              }
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

fs.writeFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-interleaved-gen.js', code);

const { TimetableGenerator } = await import('file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/engine/test-interleaved-gen.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({ maxRestarts: 150 });
console.log('Searching for perfectly balanced timetable with interleaved breaks for all 11 teachers...');

let best = null;
for (let pass = 1; pass <= 30; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    // Check max consecutive periods for ALL 11 teachers
    let maxOverallConsec = 0;
    const teacherAudits = [];

    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      let tMaxConsec = 0;
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d).sort((a,b)=>a.period_index - b.period_index);
        let c = 0, prev = -99;
        for (const s of dSlots) {
          if (s.period_index === prev + 1) c++; else c = 1;
          prev = s.period_index;
          if (c > tMaxConsec) tMaxConsec = c;
        }
      }
      if (tMaxConsec > maxOverallConsec) maxOverallConsec = tMaxConsec;
      
      const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
      teacherAudits.push({ name: t.name, total: tSlots.length, days: dayCounts, maxConsec: tMaxConsec });
    }

    console.log(`Pass #${pass}: SUCCESS! Max consecutive across school: ${maxOverallConsec}p`);
    
    // Check Sumayya specific
    const sumayyaAudit = teacherAudits.find(a => a.name.includes('Sumayya'));
    const zainabAudit = teacherAudits.find(a => a.name.includes('Zainab'));
    console.log(`  - M. Sumayya: days [${sumayyaAudit.days.join(', ')}], max consec: ${sumayyaAudit.maxConsec}p`);
    console.log(`  - M. Zainab Kabir: days [${zainabAudit.days.join(', ')}], max consec: ${zainabAudit.maxConsec}p`);

    if (maxOverallConsec <= 3 && Math.max(...sumayyaAudit.days) <= 5 && Math.max(...zainabAudit.days) <= 6) {
      best = { res, teacherAudits };
      console.log('>>> 100% PERFECT TIMETABLE ACHIEVED! ALL 11 TEACHERS BALANCED! <<<');
      break;
    }
  }
}

if (best) {
  console.log('\n========================================================================================');
  console.log('                   FINAL VERIFIED AUDIT FOR ALL 11 TEACHERS');
  console.log('========================================================================================');
  console.log('TEACHER NAME        | TOTAL | MON | TUE | WED | THU | FRI | MAX CONSEC | STATUS');
  console.log('--------------------+-------+-----+-----+-----+-----+-----+------------+----------------------');
  for (const a of best.teacherAudits) {
    const status = a.maxConsec <= 2 ? 'EXCELLENT (<=2p)' : (a.maxConsec === 3 ? 'VERY GOOD (3p)' : 'ACCEPTABLE');
    console.log(`${a.name.padEnd(19)} |   ${String(a.total).padStart(2)}  |  ${a.days[0]}  |  ${a.days[1]}  |  ${a.days[2]}  |  ${a.days[3]}  |  ${a.days[4]}  |     ${a.maxConsec}p     | ${status}`);
  }
}

fs.unlinkSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-interleaved-gen.js');
