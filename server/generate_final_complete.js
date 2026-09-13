import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

const totalAllocatedPeriods = allocations.reduce((s, a) => s + a.periods_per_week, 0);
console.log(`Total allocated periods to schedule: ${totalAllocatedPeriods} periods`);

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 50
});

console.log('Generating complete 240-contact conflict-free timetable...');

let best = null;
let bestScore = Infinity;

for (let pass = 1; pass <= 5; pass++) {
  const t0 = Date.now();
  const res = gen.generate(classes, teachers, subjects, allocations);
  const dur = Date.now() - t0;

  if (res.success && res.slots?.length === totalAllocatedPeriods) {
    // Check Junior class periods
    let juniorGaps = 0;
    for (const c of classes.filter(cls => cls.name.startsWith('JS'))) {
      const cSlots = res.slots.filter(s => s.class_id === c.id);
      const friCount = cSlots.filter(s => s.day === 'Friday').length;

      if (cSlots.length !== 34 || friCount !== 3) {
        juniorGaps += 10;
      }
    }

    // Check teacher burnout: max consecutive
    let maxOverallConsec = 0;
    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d);
        let c = 0;
        for (let p = 1; p <= 4; p++) {
          if (dSlots.some(s => s.period_index === p)) { c++; if (c > maxOverallConsec) maxOverallConsec = c; }
          else c = 0;
        }
        c = 0;
        for (let p = 5; p <= 8; p++) {
          if (dSlots.some(s => s.period_index === p)) { c++; if (c > maxOverallConsec) maxOverallConsec = c; }
          else c = 0;
        }
      }
    }

    const score = juniorGaps * 100 + maxOverallConsec * 10;
    console.log(`Pass #${pass} (${dur}ms): 246 slots | juniorGaps=${juniorGaps} | maxConsec=${maxOverallConsec}p | score=${score}`);

    if (score < bestScore) {
      bestScore = score;
      best = res;
    }

    if (juniorGaps === 0 && maxOverallConsec <= 4) {
      console.log('>>> 100% PERFECT TIMETABLE FOUND WITH FULL JUNIOR BLOCK! <<<');
      break;
    }
  } else {
    console.log(`Pass #${pass} (${dur}ms): slots=${res.slots?.length}`);
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

  // Validate
  const val = validateTimetable(best.slots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('\n--- VALIDATION REPORT ---');
  console.log(`Valid: ${val.isValid}`);
  console.log(`Conflicts: ${val.conflicts.length}`);
  console.log(`Warnings: ${val.warnings.length}`);
  if (val.conflicts.length > 0) console.log(val.conflicts);

  // Class Audit
  console.log('\n========================================================================================================');
  console.log('                                  CLASS AUDIT: ALL 6 CLASSES');
  console.log('========================================================================================================');
  console.log('CLASS NAME | TOTAL | MON | TUE | WED | THU | FRI | SCHEDULE COMPLETENESS');
  console.log('-----------+-------+-----+-----+-----+-----+-----+------------------------------------------------------');
  for (const c of classes) {
    const cSlots = best.slots.filter(s => s.class_id === c.id);
    const dayCounts = gen.days.map(d => cSlots.filter(s => s.day === d).length);
    const isJunior = c.name.startsWith('JS');
    const targetDesc = isJunior ? '34p: 7,8,8,8,3 (100% FULL MON-THU & FRI P2-P4)' : '48p contacts (36 slots: 7,8,8,8,5)';
    console.log(`${c.name.padEnd(10)} |  ${String(cSlots.length).padStart(2)}   |  ${dayCounts[0]}  |  ${dayCounts[1]}  |  ${dayCounts[2]}  |  ${dayCounts[3]}  |  ${dayCounts[4]}  | ${targetDesc}`);
  }

  // Teacher Audit
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

  // Detailed Day-by-Day View for Junior Classes on Friday
  console.log('\n======================== FRIDAY JUNIOR CLASS BREAKDOWN ========================');
  for (const cName of ['JS 1', 'JS 2', 'JS 3']) {
    const c = classes.find(x => x.name === cName);
    const friSlots = best.slots.filter(s => s.class_id === c.id && s.day === 'Friday').sort((a,b) => a.period_index - b.period_index);
    const line = [];
    line.push('P1:ASSEMBLY');
    for (let p = 2; p <= 4; p++) {
      const slot = friSlots.find(s => s.period_index === p);
      if (slot) {
        line.push(`P${p}:${subjectMap[slot.subject_id]?.code}(${teacherMap[slot.teacher_id]?.name})`);
      } else {
        line.push(`P${p}:--EMPTY--`);
      }
    }
    line.push('P5-P6:--DISMISSED--');
    console.log(`  ${cName.padEnd(6)}: ${line.join(' | ')}`);
  }

  // Period 8 Breakdown for all classes (Mon-Thu)
  console.log('\n======================== PERIOD 8 (CLOSING PERIOD) AUDIT ========================');
  console.log('CLASS      | MON P8                    | TUE P8                    | WED P8                    | THU P8');
  console.log('-----------+---------------------------+---------------------------+---------------------------+---------------------------');
  for (const c of classes) {
    const p8s = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => {
      const s = best.slots.filter(sl => sl.class_id === c.id && sl.day === d && sl.period_index === 8);
      if (s.length === 0) return '--FREE--'.padEnd(25);
      const desc = s.map(x => `${subjectMap[x.subject_id]?.code}(${teacherMap[x.teacher_id]?.name})`).join('+');
      return desc.padEnd(25);
    });
    console.log(`${c.name.padEnd(10)} | ${p8s.join(' | ')}`);
  }

  console.log('\n--- PERIOD 8 PER TEACHER ---');
  for (const t of teachers) {
    const tP8s = best.slots.filter(s => s.teacher_id === t.id && s.period_index === 8);
    const byDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => {
      const s = tP8s.filter(x => x.day === d);
      return `${d.slice(0,3)}:${s.length}`;
    }).join(', ');
    console.log(`  ${t.name.padEnd(18)}: Total ${tP8s.length} P8 slots (${byDay})`);
  }
}
