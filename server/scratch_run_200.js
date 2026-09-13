import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 200 });

let bestSlots = null;
let minUnplaced = 999;

for (let r = 0; r < 200; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
  
  if (rep.unplacedCount < minUnplaced) {
    minUnplaced = rep.unplacedCount;
  }

  if (rep.unplacedCount === 0) {
    console.log(`\n🎉🎉🎉 COMPLETE SUCCESS ON RESTART ${r}! All 246 slots placed! 🎉🎉🎉`);
    bestSlots = rep.slots;
    break;
  } else if (rep.unplacedCount === 1) {
    const u = rep.unplaced[0];
    const cName = classMap[u.class_id]?.name;
    const sCode = subjectMap[(u.alloc || u.allocA)?.subject_id]?.code;
    const tName = teacherMap[(u.alloc || u.allocA)?.teacher_id]?.name;
    console.log(`Restart ${r}: ONLY 1 UNPLACED! [${cName}] ${sCode} (${tName})`);
  }
}

console.log(`\nMinimum unplaced across 200 restarts: ${minUnplaced}`);
