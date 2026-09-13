import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';
import { validateTimetable } from './engine/validator.js';
import { ejectionChainRepair } from './test_ejection_chain_v2.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const originalAllocs = db.prepare('SELECT * FROM allocations').all();

// Clone allocations and modify for Mubarak SS 1 & SS 2 DPR = 4 contacts
const allocs = originalAllocs.map(a => {
  if (a.id === 3342) return { ...a, periods_per_week: 4, allow_double: 1 }; // SS 1 DPR
  if (a.id === 3343) return { ...a, periods_per_week: 4, allow_double: 1 }; // SS 2 DPR
  if (a.id === 3374) return { ...a, periods_per_week: 3, allow_double: 0 }; // SS 1 CIV (Abba)
  if (a.id === 3381) return { ...a, periods_per_week: 3, allow_double: 0 }; // SS 2 AGR (Amina)
  return { ...a };
});

const totalPeriods = allocs.reduce((s, a) => s + a.periods_per_week, 0);
console.log('Testing with modified allocations... Total periods:', totalPeriods);

const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });

let solved = false;
for (let r = 0; r < 40; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocs, [], r > 0);
  const rep = ejectionChainRepair(res.slots, res.unplacedUnits, gen);
  if (rep.unplacedCount === 0) {
    console.log(`\n>>> SUCCESS! SOLVED WITH MUBARAK SS 1 & SS 2 DPR = 4 CONTACTS ON RESTART ${r}! <<<`);
    const val = validateTimetable(rep.slots, classes, teachers, subjects, allocs, { fridayPeriods: 6 });
    console.log('Validation Report: Valid:', val.isValid, 'Conflicts:', val.conflicts.length, 'Warnings:', val.warnings.length);
    solved = true;
    break;
  }
}

if (!solved) {
  console.log('Did not find solution in 40 restarts.');
}
