import fs from 'fs';
import { db } from './db/database.js';
import { TimetableGenerator } from './test_gen_flagged.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

const gen = new TimetableGenerator({ maxRestarts: 200 });

console.log('Generating balanced, burnout-free timetable for all 11 teachers...');

let best = null;
let bestScore = Infinity;

for (let pass = 1; pass <= 15; pass++) {
  const t0 = Date.now();
  const res = gen.generate(classes, teachers, subjects, allocations);
  const dur = Date.now() - t0;

  if (res.success && res.slots?.length === 240) {
    const su = res.slots.filter(s => s.teacher_id === teachers.find(t => t.name.includes('Sumayya')).id);
    const suDays = gen.days.map(d => su.filter(s => s.day === d).length);
    const z = res.slots.filter(s => s.teacher_id === teachers.find(t => t.name.includes('Zainab')).id);
    const zDays = gen.days.map(d => z.filter(s => s.day === d).length);

    // Calculate score: lower is better
    // Sumayya max daily: penalize > 6 heavily, prefer <= 5
    // Max consecutive across all teachers: lower is better
    let maxOverallConsec = 0;
    let totalViolations = 0;

    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      const isShehu = t.time_preference === 'MORNING_ONLY' || t.name?.includes('Shehu');
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d);
        if (dSlots.length > 6) totalViolations += 10;
        if (d === 'Friday' && dSlots.length > 4) totalViolations += 10;

        let mCount = dSlots.filter(s => s.period_index <= 4).length;
        let aCount = dSlots.filter(s => s.period_index > 4).length;

        // Morning consec
        let c = 0;
        for (let p = 1; p <= 4; p++) {
          if (dSlots.some(s => s.period_index === p)) { c++; if (c > maxOverallConsec) maxOverallConsec = c; }
          else c = 0;
        }
        // Afternoon consec
        c = 0;
        for (let p = 5; p <= 8; p++) {
          if (dSlots.some(s => s.period_index === p)) { c++; if (c > maxOverallConsec) maxOverallConsec = c; }
          else c = 0;
        }
      }
    }

    const score = totalViolations * 100 + maxOverallConsec * 10 + (Math.max(...suDays) > 6 ? 500 : 0);
    console.log(`Pass #${pass} (${dur}ms): 240 slots | maxConsec=${maxOverallConsec}p | Sumayya=[${suDays.join(',')}] | Zainab=[${zDays.join(',')}] | score=${score}`);

    if (score < bestScore) {
      bestScore = score;
      best = res;
    }

    // Stop if excellent
    if (maxOverallConsec <= 3 && Math.max(...suDays) <= 6 && zDays[4] === 0) {
      console.log('>>> FOUND OPTIMAL SOLUTION! <<<');
      break;
    }
  }
}

if (best) {
  // Save to database
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insert = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of best.slots) {
    insert.run(s.class_id, s.subject_id, s.teacher_id, s.day, s.period_index, 0);
  }
  console.log(`\nSuccessfully saved ${best.slots.length} slots to SQLite database!`);

  console.log('\n========================================================================================================');
  console.log('                                  FINAL AUDIT: ALL 11 TEACHERS');
  console.log('========================================================================================================');
  console.log('TEACHER NAME        | TOTAL | MON | TUE | WED | THU | FRI | MAX CONSEC | MORNING REST | AFTERNOON REST');
  console.log('--------------------+-------+-----+-----+-----+-----+-----+------------+--------------+---------------');

  for (const t of teachers) {
    const tSlots = best.slots.filter(s => s.teacher_id === t.id);
    const dayCounts = gen.days.map(d => tSlots.filter(s => s.day === d).length);
    const isShehu = t.time_preference === 'MORNING_ONLY' || t.name?.includes('Shehu');
    let maxSC = 0, mBr = true, aBr = true;

    for (const d of gen.days) {
      const dSlots = tSlots.filter(s => s.day === d);
      const mS = dSlots.filter(s => s.period_index <= 4);
      const aS = dSlots.filter(s => s.period_index > 4);
      if (!isShehu) {
        if (mS.length >= 4) mBr = false;
        if (aS.length >= 4) aBr = false;
      }
      let c = 0;
      for (let p = 1; p <= 4; p++) {
        if (mS.some(s => s.period_index === p)) { c++; if (c > maxSC) maxSC = c; } else c = 0;
      }
      c = 0;
      for (let p = 5; p <= 8; p++) {
        if (aS.some(s => s.period_index === p)) { c++; if (c > maxSC) maxSC = c; } else c = 0;
      }
    }
    console.log(`${t.name.padEnd(19)} |   ${String(tSlots.length).padStart(2)}  |  ${dayCounts[0]}  |  ${dayCounts[1]}  |  ${dayCounts[2]}  |  ${dayCounts[3]}  |  ${dayCounts[4]}  |     ${maxSC}p     | ${isShehu ? 'N/A (Morn)' : (mBr ? 'GUARANTEED' : 'Occasionally')} | ${isShehu ? 'N/A (Off)' : (aBr ? 'GUARANTEED' : 'Occasionally')}`);
  }

  // Show detailed schedule for M. Sumayya and M. Zainab Kabir
  for (const tName of ['Sumayya', 'Zainab Kabir']) {
    const t = teachers.find(x => x.name.includes(tName));
    if (!t) continue;
    const tSlots = best.slots.filter(s => s.teacher_id === t.id);
    console.log(`\n============================ SCHEDULE: ${t.name} ============================`);
    for (const d of gen.days) {
      const dSlots = tSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
      const line = [];
      for (let p = 1; p <= (d === 'Friday' ? 6 : 8); p++) {
        const slot = dSlots.find(s => s.period_index === p);
        if (slot) {
          line.push(`P${p}:${subjectMap[slot.subject_id]?.code}(${classMap[slot.class_id]?.name})`);
        } else {
          line.push(`P${p}:--REST--`);
        }
      }
      console.log(`  ${d.padEnd(10)}: ${line.join(' | ')}`);
    }
  }
}
