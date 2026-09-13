import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

// Let's inspect unit 3370_s2 and why it had no candidates in _attemptSolve
// In _attemptSolve:
// Let's see what candidates were considered for 3370_s2
const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const u = res.unplacedUnits.find(x => x.unitId.includes('3370'));
console.log('Unit:', u?.unitId);

// Check why each period on Wednesday was rejected for JS 3
const js3 = classes.find(c => c.name === 'JS 3');
const d = 'Wednesday';
for (let p = 1; p <= 8; p++) {
  const cBusy = res.slots.find(s => s.class_id === js3.id && s.day === d && s.period_index === p);
  const tBusy = res.slots.find(s => s.teacher_id === u.alloc.teacher_id && s.day === d && s.period_index === p);
  console.log(`Wed P${p}: classBusy=${cBusy ? cBusy.subject_id : 'NO'}, teacherBusy=${tBusy ? tBusy.subject_id : 'NO'}`);
}
