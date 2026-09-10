import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

console.log('Testing repair pass on near-complete solutions...');

for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedCount <= 4) {
    console.log(`Restart ${r}: unplaced = ${res.unplacedCount}`);
    for (const u of res.unplacedUnits || []) {
      const alloc = u.alloc || u.allocA;
      console.log(`  Unplaced: Class=${classMap[u.class_id]?.name}, Sub=${subjectMap[alloc.subject_id]?.code}, Teacher=${teacherMap[alloc.teacher_id]?.name}`);
    }
  }
}
