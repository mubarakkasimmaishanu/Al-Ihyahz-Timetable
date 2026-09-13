import { db } from './db/database.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const slots = db.prepare('SELECT * FROM timetable_slots').all();

const js3 = classes.find(c => c.name === 'JS 3');
const js3WedP8 = slots.find(s => s.class_id === js3.id && s.day === 'Wednesday' && s.period_index === 8);
console.log('JS 3 Wed P8 slot:', js3WedP8);

// Can js3WedP8 move to Monday P8?
// On Monday, JS 3 has P8 free!
// Is M. Nabila free on Monday P8?
const nabilaMonP8 = slots.find(s => s.teacher_id === js3WedP8.teacher_id && s.day === 'Monday' && s.period_index === 8);
console.log('Is M. Nabila busy on Monday P8?', nabilaMonP8);

// If not busy, moving JS 3 Hausa to Monday P8:
// Then Wednesday in JS 3 only has P1-P6!
// Monday in JS 3 has P2-P8 (7 periods)!
// Let's test if moving js3WedP8 to Monday P8 is 100% valid!
if (nabilaMonP8) {
  console.log('Nabila is busy at Monday P8 teaching in class:', nabilaMonP8.class_id);
} else {
  console.log('M. Nabila is FREE on Monday P8!');
  // Try moving
  const updatedSlots = slots.map(s => {
    if (s.id === js3WedP8.id) {
      return { ...s, day: 'Monday', period_index: 8 };
    }
    return s;
  });
  const val = validateTimetable(updatedSlots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  console.log('Validation if moved to Monday P8: isValid =', val.isValid, 'Conflicts =', val.conflicts.length);
  if (val.isValid) {
    db.prepare('UPDATE timetable_slots SET day = ?, period_index = ? WHERE id = ?').run('Monday', 8, js3WedP8.id);
    console.log('>>> Successfully moved JS 3 Hausa to Monday P8! Now Wednesday P7 & P8 are both early closing! <<<');
  }
}
