import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

// Override JUNIOR_LIGHT_SUBJECT_CODES to include PVS and IRS
const gen = new TimetableGenerator({ maxRestarts: 50 });

let bestSuccess = null;
for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedUnits?.length > 0) {
    const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
    if (rep.success) {
      console.log(`\n🎉🎉🎉 SUCCESS on restart ${r}! All 246 slots placed! 🎉🎉🎉`);
      bestSuccess = rep.slots;
      break;
    } else {
      console.log(`Restart ${r}: solve unplaced=${res.unplacedCount} -> repair unplaced=${rep.unplacedCount} (${rep.unplaced.map(u => (classMap[u.class_id]?.name + ' ' + (subjectMap[(u.alloc||u.allocA).subject_id]?.code))).join(', ')})`);
    }
  } else {
    console.log(`\n🎉🎉🎉 DIRECT SUCCESS on restart ${r}! All 246 slots placed! 🎉🎉🎉`);
    bestSuccess = res.slots;
    break;
  }
}
