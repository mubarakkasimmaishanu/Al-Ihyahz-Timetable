import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 50 });

for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedUnits?.length > 0) {
    const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
    if (rep.success) {
      console.log(`=== FOUND 100% COMPLETE SOLUTION ON RESTART ${r}! All 246 slots placed! ===`);
      break;
    }
    if (rep.unplacedCount <= 2) {
      console.log(`Restart ${r}: unplaced = ${rep.unplacedCount} (${rep.unplaced.map(u => classMap[u.class_id]?.name + ' ' + subjectMap[(u.alloc||u.allocA).subject_id]?.code + ' ' + teacherMap[(u.alloc||u.allocA).teacher_id]?.name).join(', ')})`);
    }
  }
}
