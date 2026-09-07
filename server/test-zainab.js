import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

// Query current data
const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log(`Currently: ${classes.length} classes, ${teachers.length} teachers, ${subjects.length} subjects, ${allocations.length} allocations.`);

// Simulate adding M. Zainab Kabir
const zainabTeacher = {
  id: 999,
  name: 'M. Zainab Kabir',
  code: 'MZK',
  phone: '08036677889',
  max_daily_periods: 6,
  time_preference: 'ANY',
  unavailable_days: '["Friday"]'
};

let busSubject = subjects.find(s => s.code === 'BUS');
if (!busSubject) {
  busSubject = {
    id: 888,
    name: 'BUS',
    code: 'BUS',
    category: 'Pre-Vocational',
    color: '#ea580c'
  };
  subjects.push(busSubject);
}

const engSubject = subjects.find(s => s.code === 'ENG');

const testTeachers = [...teachers, zainabTeacher];
const testAllocations = [...allocations];

// Add Zainab's allocations
const js1 = classes.find(c => c.name === 'JS 1').id;
const js2 = classes.find(c => c.name === 'JS 2').id;
const js3 = classes.find(c => c.name === 'JS 3').id;

testAllocations.push(
  { id: 901, class_id: js1, subject_id: engSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 5, allow_double: 1 },
  { id: 902, class_id: js2, subject_id: engSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 5, allow_double: 1 },
  { id: 903, class_id: js3, subject_id: engSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 5, allow_double: 1 },
  { id: 904, class_id: js1, subject_id: busSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 3, allow_double: 0 },
  { id: 905, class_id: js2, subject_id: busSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 3, allow_double: 0 },
  { id: 906, class_id: js3, subject_id: busSubject.id, teacher_id: zainabTeacher.id, periods_per_week: 3, allow_double: 0 }
);

console.log(`Test allocations count: ${testAllocations.length} (added 6 for M. Zainab Kabir, 24 periods)`);

// Generator
const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 50
});

const result = generator.generate(classes, testTeachers, subjects, testAllocations);
console.log(`Success: ${result.success}, Restarts: ${result.restarts}, Slots: ${result.slots.length}`);

if (!result.success) {
  console.log('Diagnostics:', result.diagnostics);
} else {
  // Check Zainab slots
  const zainabSlots = result.slots.filter(s => s.teacher_id === zainabTeacher.id);
  console.log(`M. Zainab Kabir slots: ${zainabSlots.length} / 24`);
  
  const dayCounts = {};
  const periodCounts = {};
  let fridayCount = 0;
  let morningCount = 0;
  let afternoonCount = 0;

  for (const s of zainabSlots) {
    dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
    periodCounts[s.period_index] = (periodCounts[s.period_index] || 0) + 1;
    if (s.day === 'Friday') fridayCount++;
    if (s.period_index <= 4) morningCount++;
    else afternoonCount++;
  }

  console.log('Day distribution:', dayCounts);
  console.log('Period distribution:', periodCounts);
  console.log(`Friday slots: ${fridayCount} (MUST BE 0)`);
  console.log(`Morning: ${morningCount}, Afternoon: ${afternoonCount}`);
}
