import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const HEAVY_CODES = new Set(['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO']);

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 50
});

const res = gen.generate(classes, teachers, subjects, allocations);
console.log('Result:', res.success, 'Restarts:', res.restarts, 'Slots:', res.slots.length);

if (res.success) {
  const val = validateTimetable(res.slots, classes, teachers, subjects, allocations);
  console.log(`Validation: Valid=${val.isValid}, Conflicts=${val.conflictCount}, Warnings=${val.warningCount}`);

  console.log('\n--- FRIDAY SCHEDULE BY CLASS ---');
  const fridaySlots = res.slots.filter(s => s.day === 'Friday');

  for (const c of classes) {
    const cSlots = fridaySlots
      .filter(s => s.class_id === c.id)
      .sort((a, b) => a.period_index - b.period_index);
    console.log(`\nClass ${c.name} (Friday):`);
    
    // Group slots by period (paired slots share same period)
    const periodsMap = {};
    for (const s of cSlots) {
      if (!periodsMap[s.period_index]) periodsMap[s.period_index] = [];
      periodsMap[s.period_index].push(s);
    }

    for (const [p, sList] of Object.entries(periodsMap)) {
      if (sList.length === 1) {
        const s = sList[0];
        const sub = subjectMap[s.subject_id];
        const t = teacherMap[s.teacher_id];
        const isH = HEAVY_CODES.has(sub.code);
        console.log(`  Period ${p}: ${sub.code} (${t.name}) ${isH ? '[HEAVY]' : '[LIGHT]'}`);
      } else {
        const desc = sList.map(s => `${subjectMap[s.subject_id].code} (${teacherMap[s.teacher_id].name})`).join(' | ');
        console.log(`  Period ${p}: ${desc} [HEAVY PAIRED ELECTIVE]`);
      }
    }

    // Heavy count
    let heavyPeriods = 0;
    for (const [p, sList] of Object.entries(periodsMap)) {
      if (sList.some(s => HEAVY_CODES.has(subjectMap[s.subject_id]?.code))) {
        heavyPeriods++;
      }
    }
    console.log(`  Total Heavy Subject Periods on Friday: ${heavyPeriods} / 6`);
  }
}
