import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);

const js3 = classes.find(c => c.name === 'JS 3');
const classSlots = res.slots.filter(s => s.class_id === js3.id);

console.log(`JS 3 has ${classSlots.length} placed slots. Checking why none can move to Friday P3:`);
for (const existing of classSlots) {
  const existingUnit = {
    class_id: existing.class_id,
    duration: 1,
    isPaired: false,
    alloc: {
      subject_id: existing.subject_id,
      teacher_id: existing.teacher_id,
      class_id: existing.class_id
    }
  };

  const exSub = subjectMap[existing.subject_id]?.code;
  const exTeach = teacherMap[existing.teacher_id]?.name;

  const withoutExisting = res.slots.filter(s => s !== existing);
  const can = gen._canPlaceSlot(existingUnit, 'Friday', 3, withoutExisting, classMap, teacherMap, subjectMap);

  if (!can) {
    const tBusy = withoutExisting.some(s => s.teacher_id === existing.teacher_id && s.day === 'Friday' && s.period_index === 3);
    const sameSub = withoutExisting.some(s => s.class_id === js3.id && s.subject_id === existing.subject_id && s.day === 'Friday');
    const tDayCount = withoutExisting.filter(s => s.teacher_id === existing.teacher_id && s.day === 'Friday').length;
    const tObj = teacherMap[existing.teacher_id];
    let unav = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
    const isUnav = unav.includes('Friday');
    console.log(`  ${exSub}(${exTeach}) at ${existing.day} P${existing.period_index}: canMove=false -> tBusy=${tBusy}, sameSub=${sameSub}, tDayCount=${tDayCount}, isFridayUnav=${isUnav}`);
  }
}
