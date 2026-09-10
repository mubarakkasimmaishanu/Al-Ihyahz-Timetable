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

const res = gen.generate(classes, teachers, subjects, allocations);
console.log('Result success:', res.success, 'Slots count:', res.slots.length);

const mzk = teachers.find(t => t.code === 'MZK');
const mzkSlots = res.slots.filter(s => s.teacher_id === mzk.id);
mzkSlots.sort((a, b) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (a.day !== b.day) return days.indexOf(a.day) - days.indexOf(b.day);
  return a.period_index - b.period_index;
});

const subMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

console.log('\nM. Zainab Kabir Schedule:');
mzkSlots.forEach(s => {
  console.log(`${s.day.padEnd(10)} Period ${s.period_index}: ${classMap[s.class_id]} ${subMap[s.subject_id]}`);
});

// Check if any class has same subject twice on same day in separate periods
const classDaySub = {};
for (const s of res.slots) {
  const k = `${s.class_id}_${s.day}_${s.subject_id}`;
  if (!classDaySub[k]) classDaySub[k] = [];
  classDaySub[k].push(s.period_index);
}

console.log('\nChecking for non-consecutive duplicate subjects on same day:');
let issues = 0;
for (const [k, pList] of Object.entries(classDaySub)) {
  if (pList.length > 1) {
    pList.sort((a, b) => a - b);
    // check if consecutive
    for (let i = 0; i < pList.length - 1; i++) {
      if (pList[i + 1] !== pList[i] + 1) {
        const [cId, d, sId] = k.split('_');
        console.log(`ISSUE: Class ${classMap[cId]} on ${d} has ${subMap[sId]} in non-consecutive periods: ${pList.join(', ')}`);
        issues++;
      }
    }
  }
}
if (issues === 0) {
  console.log('PERFECT! ZERO non-consecutive duplicate subjects across the entire school!');
}
