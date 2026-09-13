import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

console.log(`Initial state: ${rep.slots.length} placed, ${rep.unplaced.length} unplaced.`);

// Let's test a Min-Conflicts local search where we place the unplaced unit into a conflicting slot,
// and iteratively resolve conflicts by moving conflicting slots to least-conflict positions!

const unplacedUnit = rep.unplaced[0];

// Let's test all possible slots in JS 2 where unplacedUnit could be placed:
const js2 = classes.find(c => c.name === 'JS 2');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Check each day/period for placing unplacedUnit in JS 2
for (const day of days) {
  const maxP = day === 'Friday' ? 4 : 8;
  const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;
  for (let p = startP; p <= maxP; p++) {
    // Check if JS 2 already has IRS on this day
    const hasIrsOnDay = rep.slots.some(s => s.class_id === js2.id && s.subject_id === unplacedUnit.alloc.subject_id && s.day === day);
    if (hasIrsOnDay) continue; // Hard constraint: no duplicate subject on same day

    // Check teacher (M. Nabila) availability on this day/period
    const nabilaId = unplacedUnit.alloc.teacher_id;
    const nabilaBusy = rep.slots.some(s => s.teacher_id === nabilaId && s.day === day && s.period_index === p);
    
    // Check who is currently occupying JS 2 at (day, p)
    const occupant = rep.slots.find(s => s.class_id === js2.id && s.day === day && s.period_index === p);

    console.log(`Candidate [JS 2] ${day} P${p}:`);
    console.log(`  occupant: ${occupant ? subjectMap[occupant.subject_id].code + ' (' + teacherMap[occupant.teacher_id].name + ')' : 'EMPTY'}`);
    console.log(`  nabilaBusy: ${nabilaBusy}`);
  }
}
