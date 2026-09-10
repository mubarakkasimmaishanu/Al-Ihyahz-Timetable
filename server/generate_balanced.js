import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 300
});

console.log('Generating balanced timetable (may take a minute)...');
const start = Date.now();

let best = null;
for (let pass = 1; pass <= 40; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots?.length === 240) {
    // Audit
    let violations = [];
    for (const t of teachers) {
      const tSlots = res.slots.filter(s => s.teacher_id === t.id);
      const isShehu = t.time_preference === 'MORNING_ONLY' || t.name?.includes('Shehu');
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d);
        if (dSlots.length > 6) violations.push(`${t.name} ${d}: ${dSlots.length}p daily`);
        if (d === 'Friday' && dSlots.length > 4) violations.push(`${t.name} Fri: ${dSlots.length}p`);
        if (!isShehu) {
          const mC = dSlots.filter(s => s.period_index <= 4).length;
          const aC = dSlots.filter(s => s.period_index > 4).length;
          if (mC >= 4) violations.push(`${t.name} ${d}: ${mC} morning`);
          if (aC >= 4) violations.push(`${t.name} ${d}: ${aC} afternoon`);
        }
      }
    }
    console.log(`Pass #${pass}: 240 slots, ${violations.length} violations`);
    if (violations.length > 0 && violations.length <= 5) {
      violations.forEach(v => console.log(`  - ${v}`));
    }
    if (violations.length === 0) {
      best = res;
      console.log('>>> PERFECT: ZERO VIOLATIONS! <<<');
      break;
    }
    if (!best || violations.length < (best._violations || 999)) {
      best = res;
      best._violations = violations.length;
    }
  } else {
    process.stdout.write('.');
  }
}

console.log(`\nFinished ${Date.now() - start}ms`);

if (best) {
  // Save to DB
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insert = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of best.slots) {
    insert.run(s.class_id, s.subject_id, s.teacher_id, s.day, s.period_index, 0);
  }
  console.log(`Saved ${best.slots.length} slots to database.`);

  // Final Audit
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  console.log('\n=============== FINAL AUDIT ===============');
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
    console.log(`${t.name.padEnd(19)} | ${String(tSlots.length).padStart(2)}p | [${dayCounts.join(',')}] | maxC:${maxSC} | mBr:${isShehu ? 'N/A' : mBr} | aBr:${isShehu ? 'N/A' : aBr}`);
  }

  // Show M. Sumayya and M. Zainab Kabir details
  for (const tName of ['Sumayya', 'Zainab']) {
    const t = teachers.find(x => x.name.includes(tName));
    if (!t) continue;
    const tSlots = best.slots.filter(s => s.teacher_id === t.id);
    console.log(`\n--- ${t.name} ---`);
    for (const d of gen.days) {
      const dSlots = tSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
      const line = [];
      for (let p = 1; p <= (d === 'Friday' ? 6 : 8); p++) {
        const slot = dSlots.find(s => s.period_index === p);
        if (slot) {
          line.push(`P${p}:${subjectMap[slot.subject_id]?.code}(${classMap[slot.class_id]?.name})`);
        } else {
          line.push(`P${p}:FREE`);
        }
      }
      console.log(`  ${d.padEnd(10)}: ${line.join(' | ')}`);
    }
  }
}
