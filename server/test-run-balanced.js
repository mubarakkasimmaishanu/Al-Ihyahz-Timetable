import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 100
});

console.log('Running balanced generator with fair Period 8 rotation & anti double-double...');

const t0 = Date.now();
const res = gen.generate(classes, teachers, subjects, allocations, []);
const dur = Date.now() - t0;

console.log(`\nResult: success=${res.success}, slots=${res.slots?.length}, time=${dur}ms, restarts=${res.restarts}`);
if (!res.success) {
  console.log('Unplaced count:', res.diagnostics?.length);
  console.log('Diagnostics sample:', res.diagnostics?.slice(0, 5));
} else {
  console.log('=== AUDITING GENERATED TIMETABLE ===\n');

  // 1. Period 8 Distribution across teachers
  console.log('--- Period 8 Distribution Across Teachers ---');
  const p8ByTeacher = {};
  for (const s of res.slots) {
    if (s.period_index === 8) {
      const tName = teacherMap[s.teacher_id]?.name || s.teacher_id;
      p8ByTeacher[tName] = (p8ByTeacher[tName] || 0) + 1;
    }
  }
  console.table(p8ByTeacher);

  // 2. M. Sumayya check
  const sumayyaId = teachers.find(t => t.name.includes('Sumayya'))?.id;
  const suSlots = res.slots.filter(s => s.teacher_id === sumayyaId);
  const suP8 = suSlots.filter(s => s.period_index === 8);
  console.log(`M. Sumayya total slots: ${suSlots.length}, Period 8 slots: ${suP8.length}`);
  console.table(suP8.map(s => ({
    class: classMap[s.class_id].name,
    subject: subjectMap[s.subject_id].code,
    day: s.day,
    period: s.period_index
  })));

  // 3. M. Maryam check (Look for consecutive periods in same class)
  const maryamId = teachers.find(t => t.name.includes('Maryam'))?.id;
  const mySlots = res.slots.filter(s => s.teacher_id === maryamId);
  console.log(`\nM. Maryam total slots: ${mySlots.length}`);
  
  // Check if any class has M. Maryam > 2 consecutive periods
  let maryamClassViolations = 0;
  for (const c of classes) {
    for (const d of gen.days) {
      const daySlots = mySlots.filter(s => s.class_id === c.id && s.day === d).sort((a, b) => a.period_index - b.period_index);
      for (let i = 0; i < daySlots.length - 1; i++) {
        if (daySlots[i+1].period_index === daySlots[i].period_index + 1) {
          if (i < daySlots.length - 2 && daySlots[i+2].period_index === daySlots[i].period_index + 2) {
            console.error(`VIOLATION: M. Maryam has >= 3 consecutive periods in ${c.name} on ${d}: P${daySlots[i].period_index}, P${daySlots[i+1].period_index}, P${daySlots[i+2].period_index}`);
            maryamClassViolations++;
          }
        }
      }
    }
  }
  if (maryamClassViolations === 0) {
    console.log('SUCCESS: Zero instances of M. Maryam having > 2 consecutive periods in any class!');
  }

  // 4. Period 8 Junior Subject Audit
  console.log('\n--- Junior Classes Period 8 Subjects ---');
  const juniorP8 = res.slots.filter(s => {
    const c = classMap[s.class_id];
    return (c.level === 'JS' || c.name.startsWith('JS')) && s.period_index === 8;
  });
  console.table(juniorP8.map(s => ({
    class: classMap[s.class_id].name,
    day: s.day,
    subject: subjectMap[s.subject_id].code,
    teacher: teacherMap[s.teacher_id].name
  })));
}
