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

// Move STP from Wed P8 to Thu P8:
const stpWedP8 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Wednesday' && s.period_index === 8);
const withoutStp = rep.slots.filter(s => s !== stpWedP8);
const slotsWithStpAtThu = [...withoutStp, { ...stpWedP8, day: 'Thursday', period_index: 8 }];

console.log('Now Wednesday P8 is EMPTY in JS 2. Which JS 2 slot can move to Wednesday P8?');
for (const s of withoutStp.filter(s => s.class_id === js2.id)) {
  const withoutS = slotsWithStpAtThu.filter(x => x !== s);
  const u = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: s.subject_id, teacher_id: s.teacher_id, class_id: js2.id } };
  if (gen._canPlaceSlot(u, 'Wednesday', 8, withoutS, classMap, teacherMap, subjectMap)) {
    const sub = subjectMap[s.subject_id].code;
    const t = teacherMap[s.teacher_id].name;
    console.log(`  CAN MOVE to Wed P8: [${s.day} P${s.period_index}] ${sub} (${t})`);
    
    // If this slot s moves to Wed P8, can unplaced JS 2 IRS take s.day, s.period_index?
    const withSMoved = [...withoutS, { ...s, day: 'Wednesday', period_index: 8 }];
    const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);
    const canIrs = gen._canPlaceSlot(irsUnit, s.day, s.period_index, withSMoved, classMap, teacherMap, subjectMap);
    console.log(`    -> Can JS 2 IRS take [${s.day} P${s.period_index}]? ${canIrs}`);
  }
}
