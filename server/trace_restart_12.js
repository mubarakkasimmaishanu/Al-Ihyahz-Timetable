import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });

// Let's trace restart 12
console.log('Tracing restart 12 placement...');
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], 12);
console.log('Unplaced count:', res.unplacedCount);
for (const u of res.unplacedUnits) {
  console.log('Unplaced:', u.unitId, 'Class:', classMap[u.class_id].name, 'dur:', u.duration);
}
