import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const js2 = classes.find(c => c.name === 'JS 2');
const pvs = subjects.find(s => s.code === 'PVS');
const bus = subjects.find(s => s.code === 'BUS');
const cmp = subjects.find(s => s.code === 'CMP');
const stp = subjects.find(s => s.code === 'STP');

const maryam = teachers.find(t => t.name.includes('Maryam'));
const zainab = teachers.find(t => t.name.includes('Zainab'));
const sumayya = teachers.find(t => t.name.includes('Sumayya'));
const yusuf = teachers.find(t => t.name.includes('Yusuf'));

const lockedSlots = [
  { class_id: js2.id, subject_id: pvs.id, teacher_id: maryam.id, day: 'Monday', period_index: 8, is_locked: 1 },
  { class_id: js2.id, subject_id: bus.id, teacher_id: zainab.id, day: 'Tuesday', period_index: 8, is_locked: 1 },
  { class_id: js2.id, subject_id: cmp.id, teacher_id: sumayya.id, day: 'Wednesday', period_index: 8, is_locked: 1 },
  { class_id: js2.id, subject_id: stp.id, teacher_id: yusuf.id, day: 'Thursday', period_index: 8, is_locked: 1 },
];

console.log('Testing with JS 2 Period 8 locked slots...');
const gen = new TimetableGenerator({ maxRestarts: 50 });

let bestSlots = null;

for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, lockedSlots, r > 0);
  const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
  
  if (rep.unplacedCount === 0) {
    console.log(`\n🎉🎉🎉 SUCCESS ON RESTART ${r}! ALL 246 SLOTS PLACED! 🎉🎉🎉`);
    bestSlots = rep.slots;
    break;
  } else {
    console.log(`Restart ${r}: unplaced=${rep.unplacedCount} (${rep.unplaced.map(u => (classMap[u.class_id]?.name + ' ' + (subjectMap[(u.alloc||u.allocA).subject_id]?.code))).join(', ')})`);
  }
}

if (bestSlots) {
  const val = validateTimetable(bestSlots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('\nVALIDATION RESULT:');
  console.log('  isValid:', val.isValid);
  console.log('  conflicts:', val.conflicts.length);
  console.log('  warnings:', val.warnings.length);
  if (val.conflicts.length > 0) console.log('Conflicts:', val.conflicts);
  if (val.warnings.length > 0) console.log('Warnings:', val.warnings);
}
