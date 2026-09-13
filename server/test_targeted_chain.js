import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

const js2 = classes.find(c => c.name === 'JS 2');

// Move 1: [JS 2] STP from Wed P8 to Thu P8
const stpWedP8 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Wednesday' && s.period_index === 8);
const withoutStp = rep.slots.filter(s => s !== stpWedP8);
const slots1 = [...withoutStp, { ...stpWedP8, day: 'Thursday', period_index: 8 }];

// Move 2: [JS 2] CMP from Mon P8 to Wed P8
const cmpMonP8 = slots1.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 8);
const withoutCmp = slots1.filter(s => s !== cmpMonP8);
const slots2 = [...withoutCmp, { ...cmpMonP8, day: 'Wednesday', period_index: 8 }];

console.log('Now in JS 2:');
console.log('  Thu P8 has: STP (Yusuf)');
console.log('  Wed P8 has: CMP (Sumayya)');
console.log('  Mon P8 is: EMPTY');

// Let's test all single slots in JS 2 (or any class) that can move to Mon P8:
for (const s of slots2.filter(s => s.class_id === js2.id)) {
  const withoutS = slots2.filter(x => x !== s);
  const u = {
    class_id: js2.id,
    duration: 1,
    isPaired: false,
    alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: js2.id }
  };
  const can = gen._canPlaceSlot(u, 'Monday', 8, withoutS, classMap, teacherMap, subjectMap);
  if (can) {
    console.log(`  Can move to Mon P8: [${s.day} P${s.period_index}] ${subjectMap[s.subject_id].code} (${teacherMap[s.teacher_id].name})`);
  }
}
