import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 100
});

console.log('Testing repair with threshold 25...');

let solved = false;
for (let r = 0; r < 30; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.success) {
    console.log('SOLVED directly at restart', r);
    solved = true;
    break;
  }
  if (res.unplacedCount <= 25) {
    const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
    console.log(`Restart ${r}: unplaced=${res.unplacedCount} -> repaired unplaced=${rep.unplacedCount}, slots=${rep.slots.length}`);
    if (rep.success && rep.slots.length === 246) {
      console.log('>>> REPAIR SOLVED ALL 246 SLOTS! <<<');
      solved = true;
      break;
    }
  }
}
