import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const gen = new TimetableGenerator({ maxRestarts: 100 });

console.log('Testing 50 restarts of _attemptSolve on 246 allocations...');
let minUnplaced = 999;

for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedCount < minUnplaced) {
    minUnplaced = res.unplacedCount;
    console.log(`Restart #${r}: unplaced = ${res.unplacedCount}`);
  }
  if (res.unplacedCount === 0) {
    console.log(`*** FOUND 0 UNPLACED at restart #${r}! ***`);
    break;
  }
}
console.log('Best unplaced count:', minUnplaced);
