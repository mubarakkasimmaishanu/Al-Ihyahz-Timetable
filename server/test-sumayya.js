import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log(`Current: ${classes.length} classes, ${teachers.length} teachers, ${subjects.length} subjects, ${allocations.length} allocations.`);

// Add M. Sumayya
const sumayyaTeacher = {
  id: 777,
  name: 'M. Sumayya',
  code: 'MSM',
  phone: '08037788990',
  max_daily_periods: 5,
  time_preference: 'ANY',
  unavailable_days: '[]'
};

const engSubject = subjects.find(s => s.code === 'ENG');
const compSubject = subjects.find(s => s.code === 'CMP');

const ss1 = classes.find(c => c.name === 'SS 1').id;
const ss2 = classes.find(c => c.name === 'SS 2').id;
const ss3 = classes.find(c => c.name === 'SS 3').id;
const js1 = classes.find(c => c.name === 'JS 1').id;
const js2 = classes.find(c => c.name === 'JS 2').id;
const js3 = classes.find(c => c.name === 'JS 3').id;

const testTeachers = [...teachers, sumayyaTeacher];
const testAllocations = [
  ...allocations,
  // English SS 1 to 3 (5 contacts each: mixed double with single, e.g. 1 double + 3 singles or 2 doubles + 1 single)
  { id: 911, class_id: ss1, subject_id: engSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 5, allow_double: 1 },
  { id: 912, class_id: ss2, subject_id: engSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 5, allow_double: 1 },
  { id: 913, class_id: ss3, subject_id: engSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 5, allow_double: 1 },
  // Computer JS 1 to 3 (3 contacts each)
  { id: 914, class_id: js1, subject_id: compSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 3, allow_double: 0 },
  { id: 915, class_id: js2, subject_id: compSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 3, allow_double: 0 },
  { id: 916, class_id: js3, subject_id: compSubject.id, teacher_id: sumayyaTeacher.id, periods_per_week: 3, allow_double: 0 }
];

console.log(`Test allocations count: ${testAllocations.length} (total weekly load = 147 slots)`);

const generator = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 50
});

const result = generator.generate(classes, testTeachers, subjects, testAllocations);
console.log(`Success: ${result.success}, Restarts: ${result.restarts}, Slots: ${result.slots.length}`);

if (result.success) {
  const sumayyaSlots = result.slots.filter(s => s.teacher_id === sumayyaTeacher.id);
  console.log(`M. Sumayya total slots: ${sumayyaSlots.length} / 24`);

  const dayCounts = {};
  const periodCounts = {};
  let morning = 0;
  let afternoon = 0;

  for (const s of sumayyaSlots) {
    dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
    periodCounts[s.period_index] = (periodCounts[s.period_index] || 0) + 1;
    if (s.period_index <= 4) morning++;
    else afternoon++;
  }

  console.log('Day distribution:', dayCounts);
  console.log('Period distribution:', periodCounts);
  console.log(`Morning (P1-P4): ${morning}, Afternoon (P5-P8): ${afternoon}`);

  // Check English slots in SS 1-3 for tired hours (P7, P8 on Mon-Thu, P5, P6 on Fri)
  const engSlots = sumayyaSlots.filter(s => s.subject_id === engSubject.id);
  console.log('\nEnglish slots in SS 1-3:');
  for (const s of engSlots) {
    const cls = classes.find(c => c.id === s.class_id)?.name;
    console.log(`  ${cls} - ${s.day} Period ${s.period_index}`);
  }
}
