import { seedDatabase } from './db/seed.js';
import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

console.log('--- Seeding Database with NV=4 and Junior IRS=4 ---');
seedDatabase();

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const totalAllocatedPeriods = allocations.reduce((s, a) => s + a.periods_per_week, 0);
console.log(`Total allocated curriculum contacts across school: ${totalAllocatedPeriods} periods`);

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 150
});

console.log('Searching for 100% clash-free, 0-gap timetable (Target: 246 slots)...');
let best = null;
let bestGaps = 999;
const start = Date.now();

for (let pass = 1; pass <= 60; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots.length === 246) {
    const val = validateTimetable(res.slots, classes, teachers, subjects, allocations, {
      fridayPeriods: 6,
      regularPeriods: 8
    });

    if (val.conflicts.length > 0) continue;

    // Check Assembly strictly free on Mon & Fri
    const p1MonFri = res.slots.filter(s => (s.day === 'Monday' || s.day === 'Friday') && s.period_index === 1);
    if (p1MonFri.length > 0) continue;

    let gaps = 0;
    for (const c of classes) {
      for (const d of gen.days) {
        const slots = res.slots.filter(s => s.class_id === c.id && s.day === d);
        const indices = new Set(slots.map(s => s.period_index));
        const maxP = Math.max(0, ...indices);
        const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
        for (let p = startP; p < maxP; p++) {
          if (!indices.has(p)) gaps++;
        }
      }
    }

    console.log(`Pass #${pass}: 246 slots placed! Conflicts: 0, Gaps: ${gaps}`);

    if (gaps < bestGaps) {
      bestGaps = gaps;
      best = res;
    }

    if (gaps === 0) {
      best = res;
      console.log(`>>> FOUND PERFECT ZERO-GAP SOLUTION ON PASS #${pass}! <<<`);
      break;
    }
  }
}

console.log(`Search finished in ${Date.now() - start}ms.`);
if (best) {
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insert = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of best.slots) {
    insert.run(s.class_id, s.subject_id, s.teacher_id, s.day, s.period_index, 0);
  }
  console.log(`Successfully saved ${best.slots.length} conflict-free slots to SQLite database! (Best Gaps: ${bestGaps})`);
} else {
  console.error('Failed to find a 246-slot solution.');
}
