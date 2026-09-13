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
const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);

console.log('Testing Option A: [Wednesday P8] STP (M. Yusuf) -> Thursday P8');
const stpWedP8 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Wednesday' && s.period_index === 8);
if (stpWedP8) {
  const withoutStp = rep.slots.filter(s => s !== stpWedP8);
  const stpUnit = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: stpWedP8.subject_id, teacher_id: stpWedP8.teacher_id, class_id: js2.id } };
  const canStpThuP8 = gen._canPlaceSlot(stpUnit, 'Thursday', 8, withoutStp, classMap, teacherMap, subjectMap);
  console.log('  Can move STP to Thursday P8:', canStpThuP8);
  if (canStpThuP8) {
    const slotsWithStpAtThu = [...withoutStp, { ...stpWedP8, day: 'Thursday', period_index: 8 }];
    const canIrsWedP8 = gen._canPlaceSlot(irsUnit, 'Wednesday', 8, slotsWithStpAtThu, classMap, teacherMap, subjectMap);
    console.log('  Can place JS 2 IRS at Wednesday P8?', canIrsWedP8);
    if (!canIrsWedP8) {
      // Why not?
      const tId = irsUnit.alloc.teacher_id;
      const t = teacherMap[tId];
      console.log('    M. Nabila busy Wed P8?', slotsWithStpAtThu.some(s => s.teacher_id === tId && s.day === 'Wednesday' && s.period_index === 8));
      console.log('    JS 2 has IRS on Wed?', slotsWithStpAtThu.some(s => s.class_id === js2.id && s.subject_id === irsUnit.alloc.subject_id && s.day === 'Wednesday'));
      console.log('    M. Nabila Wed daily slots:', slotsWithStpAtThu.filter(s => s.teacher_id === tId && s.day === 'Wednesday').length);
      console.log('    M. Nabila Wed slots:', slotsWithStpAtThu.filter(s => s.teacher_id === tId && s.day === 'Wednesday').map(s => `P${s.period_index} [${classMap[s.class_id]?.name}]`));
    }
  }
}

console.log('\nTesting Option B: [Monday P8] CMP (M. Sumayya) -> Thursday P8');
const cmpMonP8 = rep.slots.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 8);
if (cmpMonP8) {
  const withoutCmp = rep.slots.filter(s => s !== cmpMonP8);
  const cmpUnit = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: cmpMonP8.subject_id, teacher_id: cmpMonP8.teacher_id, class_id: js2.id } };
  const canCmpThuP8 = gen._canPlaceSlot(cmpUnit, 'Thursday', 8, withoutCmp, classMap, teacherMap, subjectMap);
  console.log('  Can move CMP to Thursday P8:', canCmpThuP8);
  if (canCmpThuP8) {
    const slotsWithCmpAtThu = [...withoutCmp, { ...cmpMonP8, day: 'Thursday', period_index: 8 }];
    const canIrsMonP8 = gen._canPlaceSlot(irsUnit, 'Monday', 8, slotsWithCmpAtThu, classMap, teacherMap, subjectMap);
    console.log('  Can place JS 2 IRS at Monday P8?', canIrsMonP8);
    if (!canIrsMonP8) {
      const tId = irsUnit.alloc.teacher_id;
      console.log('    M. Nabila busy Mon P8?', slotsWithCmpAtThu.some(s => s.teacher_id === tId && s.day === 'Monday' && s.period_index === 8));
      console.log('    JS 2 has IRS on Mon?', slotsWithCmpAtThu.some(s => s.class_id === js2.id && s.subject_id === irsUnit.alloc.subject_id && s.day === 'Monday'));
      console.log('    M. Nabila Mon daily slots:', slotsWithCmpAtThu.filter(s => s.teacher_id === tId && s.day === 'Monday').length);
      console.log('    M. Nabila Mon slots:', slotsWithCmpAtThu.filter(s => s.teacher_id === tId && s.day === 'Monday').map(s => `P${s.period_index} [${classMap[s.class_id]?.name}]`));
    }
  }
}
