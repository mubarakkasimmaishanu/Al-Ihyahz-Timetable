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

const js2 = classes.find(c => c.name === 'JS 2');
const irsUnit = rep.unplaced.find(u => u.class_id === js2.id);

let currentSlots = rep.slots.map(s => ({ ...s }));

// Check all slots in JS 2
console.log('Current JS 2 schedule:');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
for (const d of days) {
  const dSlots = currentSlots.filter(s => s.class_id === js2.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
  console.log(`  ${d}: ` + dSlots.map(s => `P${s.period_index}:${subjectMap[s.subject_id].code}(${teacherMap[s.teacher_id].name.split(' ').pop()})`).join(', '));
}

// Let's test placing irsUnit at Tuesday P5:
// In JS 2, Tuesday P5 currently has CMP (Sumayya)
const js2CmpTueP5 = currentSlots.find(s => s.class_id === js2.id && s.day === 'Tuesday' && s.period_index === 5);
console.log('\njs2CmpTueP5:', js2CmpTueP5 ? subjectMap[js2CmpTueP5.subject_id].code : 'none');

// If we remove js2CmpTueP5, can irsUnit go to Tuesday P5?
const withoutCmpTueP5 = currentSlots.filter(s => s !== js2CmpTueP5);
const canIrsTueP5 = gen._canPlaceSlot(irsUnit, 'Tuesday', 5, withoutCmpTueP5, classMap, teacherMap, subjectMap);
console.log('Can JS 2 IRS go to Tuesday P5 (without CMP)?', canIrsTueP5);

// Now CMP needs a home.
// What if CMP moves to Thursday P8?
// In JS 2, Monday already has CMP at P8.
// But what if JS 2 Monday P8 CMP moves to Monday P6, or PVS moves to Monday P8?
const cmpMonP8 = currentSlots.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 8);
const pvsMonP6 = currentSlots.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 6);

console.log('cmpMonP8:', !!cmpMonP8, 'pvsMonP6:', !!pvsMonP6);
