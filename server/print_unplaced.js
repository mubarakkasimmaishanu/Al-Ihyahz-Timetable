import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 10 });

for (let r = 0; r < 10; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedCount <= 8) {
    console.log(`\nRestart #${r}: unplaced = ${res.unplacedCount}`);
    for (const u of res.unplacedUnits) {
      const c = classMap[u.class_id]?.name;
      const t = teacherMap[(u.alloc || u.allocA).teacher_id]?.name;
      const s = subjectMap[(u.alloc || u.allocA).subject_id]?.code;
      console.log(`  - [${c}] ${s} (${t}) dur=${u.duration}`);
    }
    break;
  }
}
