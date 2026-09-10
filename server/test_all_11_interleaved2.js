import fs from 'fs';
import { db } from 'file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/db/database.js';

let code = fs.readFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/generator.js', 'utf8');

code = code.replace('result.unplacedCount <= 6', 'result.unplacedCount <= 12');
code = code.replace('const maxFri = isJunior ? 3 : 5;', 'const maxFri = isJunior ? 1 : 5;');

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
            let unav = [];
            try {
              unav = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
            } catch { unav = []; }
            const isFourDayTeacher = Array.isArray(unav) && unav.includes('Friday');

            // 1. Daily Workload Caps:
            if (isFourDayTeacher) {
              // 4-day staff (M. Shehu, M. Zainab Kabir): strictly max 6 periods/day
              if (teacherDaily + unit.duration > 6) continue;
            } else {
              // 5-day staff: Friday strictly max 4 (dismissal at Juma'at). Mon-Thu strictly max 6, heavily prefer <= 5.
              if (day === 'Friday' && teacherDaily + unit.duration > 4) continue;
              if (teacherDaily + unit.duration > 6) continue;
              if (teacherDaily + unit.duration > 5) {
                penalty += 3500 * (teacherDaily + unit.duration - 5);
              }
            }

            // 2. Mandatory Breathers in Morning (P1-P4) and Afternoon (P5-P8):
            // A teacher must NEVER teach all 4 periods before break (P1-P4) or all 4 after break (P5-P8)!
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration >= 4) {
              continue; // GUARANTEES AT LEAST ONE 40-MIN FREE PERIOD BEFORE BREAK!
            }
            if (p > 4 && dayAfter + unit.duration >= 4) {
              continue; // GUARANTEES AT LEAST ONE 40-MIN FREE PERIOD AFTER BREAK!
            }

            // 3. Consecutive Block Cap: Max 2 (at most 3) consecutive periods
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
              continue; // Strictly forbidden to teach 4 in a row in morning or afternoon!
            } else if (sessionConsec === 3) {
              penalty += 1800; // Prefer blocks of 1 or 2 periods followed by a breather
            }`;

code = code.replace(oldBurnoutBlock, newBurnoutBlock);

fs.writeFileSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-interleaved-gen2.js', code);

const { TimetableGenerator } = await import('file:///C:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/server/engine/test-interleaved-gen2.js');

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({ maxRestarts: 150 });
console.log('Testing strict interleaved break algorithm across all 11 teachers...');

let best = null;
for (let pass = 1; pass <= 20; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    const teacherAudits = [];
    let maxOverallSessionConsec = 0;

    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      let maxSessionConsec = 0;
      let hasMorningBreather = true;
      let hasAfternoonBreather = true;

      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d);
        const mSlots = dSlots.filter(s => s.period_index <= 4);
        const aSlots = dSlots.filter(s => s.period_index > 4);

        if (mSlots.length >= 4) hasMorningBreather = false;
        if (aSlots.length >= 4) hasAfternoonBreather = false;

        // Morning consec
        let c = 0;
        for (let p = 1; p <= 4; p++) {
          if (mSlots.some(s => s.period_index === p)) { c++; if (c > maxSessionConsec) maxSessionConsec = c; }
          else c = 0;
        }
        // Afternoon consec
        c = 0;
        for (let p = 5; p <= 8; p++) {
          if (aSlots.some(s => s.period_index === p)) { c++; if (c > maxSessionConsec) maxSessionConsec = c; }
          else c = 0;
        }
      }

      if (maxSessionConsec > maxOverallSessionConsec) maxOverallSessionConsec = maxSessionConsec;
      const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
      teacherAudits.push({ name: t.name, total: tSlots.length, days: dayCounts, maxSessionConsec, hasMorningBreather, hasAfternoonBreather });
    }

    console.log(`Pass #${pass}: SUCCESS 240 slots! Max session consecutive across ALL 11 teachers: ${maxOverallSessionConsec}p`);
    const sumayya = teacherAudits.find(a => a.name.includes('Sumayya'));
    const zainab = teacherAudits.find(a => a.name.includes('Zainab'));
    console.log(`  - M. Sumayya: [${sumayya.days.join(', ')}], max session consec: ${sumayya.maxSessionConsec}p, morning breather: ${sumayya.hasMorningBreather}, afternoon breather: ${sumayya.hasAfternoonBreather}`);
    console.log(`  - M. Zainab Kabir: [${zainab.days.join(', ')}], max session consec: ${zainab.maxSessionConsec}p, morning breather: ${zainab.hasMorningBreather}, afternoon breather: ${zainab.hasAfternoonBreather}`);

    if (maxOverallSessionConsec <= 3 && Math.max(...sumayya.days) <= 5 && Math.max(...zainab.days) <= 6) {
      best = { res, teacherAudits };
      console.log('>>> 100% PERFECT TIMETABLE FOUND WITH INTERLEAVED BREAKS FOR ALL 11 TEACHERS! <<<');
      break;
    }
  }
}

if (best) {
  console.log('\n========================================================================================================');
  console.log('                            FINAL AUDIT: ALL 11 TEACHERS BALANCED');
  console.log('========================================================================================================');
  console.log('TEACHER NAME        | TOTAL | MON | TUE | WED | THU | FRI | MAX CONSEC | MORNING REST | AFTERNOON REST');
  console.log('--------------------+-------+-----+-----+-----+-----+-----+------------+--------------+---------------');
  for (const a of best.teacherAudits) {
    console.log(`${a.name.padEnd(19)} |   ${String(a.total).padStart(2)}  |  ${a.days[0]}  |  ${a.days[1]}  |  ${a.days[2]}  |  ${a.days[3]}  |  ${a.days[4]}  |     ${a.maxSessionConsec}p     | ${a.hasMorningBreather ? 'GUARANTEED' : 'NO'}   | ${a.hasAfternoonBreather ? 'GUARANTEED' : 'NO'}`);
  }
}

fs.unlinkSync('C:/Users/MY PC/Desktop/Al-Ihyahz Timetable/server/engine/test-interleaved-gen2.js');
