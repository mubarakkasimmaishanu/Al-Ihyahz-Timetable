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

const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
console.log('Unplaced count from _attemptSolve:', res.unplacedCount);
for (const u of (res.unplacedUnits || [])) {
  const c = classMap[u.class_id]?.name;
  const t = teacherMap[(u.alloc || u.allocA).teacher_id]?.name;
  const s = subjectMap[(u.alloc || u.allocA).subject_id]?.code;
  console.log(`  - [${c}] ${s} (${t}) dur=${u.duration} isDouble=${u.duration === 2}`);
}
