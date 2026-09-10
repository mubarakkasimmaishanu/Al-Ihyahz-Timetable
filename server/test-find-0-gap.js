import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 4,
  maxRestarts: 150
});

console.log('Searching for 100% balanced solution with zero gaps and balanced Friday...');
let best = null;
let passes = 0;
const start = Date.now();

while (passes < 40) {
  passes++;
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots.length === 240) {
    let gaps = 0;
    for (const c of classes) {
      for (const d of gen.days) {
        const slots = res.slots.filter(s => s.class_id === c.id && s.day === d);
        const indices = new Set(slots.map(s => s.period_index));
        const maxP = Math.max(0, ...indices);
        for (let p = 1; p < maxP; p++) {
          if (!indices.has(p)) gaps++;
        }
      }
    }

    const minFri = Math.min(...classes.map(c => res.slots.filter(s => s.class_id === c.id && s.day === 'Friday').length));
    console.log(`Pass #${passes}: Gaps = ${gaps}, Min Friday periods across classes = ${minFri}`);

    if (gaps === 0 && minFri >= 3) {
      best = res;
      console.log(`FOUND PERFECT SOLUTION on pass #${passes} (min Friday = ${minFri})!`);
      break;
    }
    if (gaps === 0 && !best) {
      best = res;
    }
  }
}

console.log(`Finished in ${Date.now() - start}ms.`);
if (best) {
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insert = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of best.slots) {
    insert.run(s.class_id, s.subject_id, s.teacher_id, s.day, s.period_index, 0);
  }
  console.log(`Saved ${best.slots.length} slots to DB!`);
}
