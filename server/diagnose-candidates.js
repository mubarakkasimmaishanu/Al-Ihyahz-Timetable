import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

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

// Let's run attempt solve up to unplaced, and inspect why the unplaced unit had no candidates:
const unplacedUnits = ['2826_s1', '2830_s1', '2813_s2', '2813_s1', '2824_s3', '2824_s2', '2824_s1', '2825_s2', '2825_s1'];

for (const uid of unplacedUnits) {
  const allocId = Number(uid.split('_')[0]);
  const alloc = allocations.find(a => a.id === allocId);
  if (alloc) {
    console.log(`Unit ${uid}: Class=${classMap[alloc.class_id]?.name}, Sub=${subjectMap[alloc.subject_id]?.code}, Teacher=${teacherMap[alloc.teacher_id]?.name}`);
  }
}
