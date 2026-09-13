import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

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
let currentSlots = rep.slots.map(s => ({ ...s }));

const cmpMonP8 = currentSlots.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 8);
const pvsMonP6 = currentSlots.find(s => s.class_id === js2.id && s.day === 'Monday' && s.period_index === 6);

// Can CMP go to Monday P6?
const withoutBoth = currentSlots.filter(s => s !== cmpMonP8 && s !== pvsMonP6);
const cmpUnit = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: cmpMonP8.subject_id, teacher_id: cmpMonP8.teacher_id, class_id: js2.id } };
const pvsUnit = { class_id: js2.id, duration: 1, isPaired: false, alloc: { subject_id: pvsMonP6.subject_id, teacher_id: pvsMonP6.teacher_id, class_id: js2.id } };

const canCmpAtMonP6 = gen._canPlaceSlot(cmpUnit, 'Monday', 6, withoutBoth, classMap, teacherMap, subjectMap);
console.log('Can JS 2 CMP go to Monday P6?', canCmpAtMonP6);

const withCmpAtMonP6 = [...withoutBoth, { ...cmpMonP8, period_index: 6 }];
const canPvsAtMonP8 = gen._canPlaceSlot(pvsUnit, 'Monday', 8, withCmpAtMonP6, classMap, teacherMap, subjectMap);
console.log('Can JS 2 PVS go to Monday P8?', canPvsAtMonP8);
