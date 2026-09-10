import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
let allocations = db.prepare('SELECT * FROM allocations').all();

const nvSub = subjects.find(s => s.code === 'NV');
const irsSub = subjects.find(s => s.code === 'IRS');
const jsClasses = classes.filter(c => c.name.startsWith('JS'));

console.log('Testing NV = 4 contacts, Junior IRS = 4 contacts');
for (const a of allocations) {
  if (jsClasses.some(c => c.id === a.class_id)) {
    if (a.subject_id === nvSub.id) {
      a.periods_per_week = 4;
      a.allow_double = 1;
    }
    if (a.subject_id === irsSub.id) {
      a.periods_per_week = 4;
      a.allow_double = 1;
    }
  }
}

const maryam = teachers.find(t => t.name.includes('Maryam'));
const nabila = teachers.find(t => t.name.includes('Nabila'));
const mAllocs = allocations.filter(a => a.teacher_id === maryam.id);
const nAllocs = allocations.filter(a => a.teacher_id === nabila.id);
console.log(`M. Maryam total load: ${mAllocs.reduce((s, a) => s + a.periods_per_week, 0)} periods`);
console.log(`M. Nabila total load: ${nAllocs.reduce((s, a) => s + a.periods_per_week, 0)} periods`);

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 4,
  maxRestarts: 100
});

let bestRes = null;
let bestGaps = 999;

for (let pass = 1; pass <= 30; pass++) {
  const res = gen.generate(classes, teachers, subjects, allocations);
  if (res.success && res.slots.length === 246) {
    const val = validateTimetable(res.slots, classes, teachers, subjects, allocations, {
      fridayPeriods: 4,
      regularPeriods: 8
    });
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
    console.log(`Pass ${pass}: 246 slots placed! Conflicts: ${val.conflicts.length}, Gaps: ${gaps}`);
    if (val.conflicts.length === 0 && gaps < bestGaps) {
      bestGaps = gaps;
      bestRes = res;
      if (gaps === 0) {
        console.log(`>>> PERFECT 0-GAP 0-CLASH SOLUTION FOUND ON PASS ${pass}! <<<`);
        break;
      }
    }
  }
}
