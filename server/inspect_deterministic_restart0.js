import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 1 });
const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);
const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

console.log('=== RESTART 0 EXACT STATE ===');
console.log(`Placed: ${rep.slots.length} / 246, Unplaced: ${rep.unplaced.length}`);

for (const u of rep.unplaced) {
  const c = classMap[u.class_id];
  const tId = (u.alloc||u.allocA).teacher_id;
  const sId = (u.alloc||u.allocA).subject_id;
  const t = teacherMap[tId];
  const s = subjectMap[sId];

  console.log(`\n------------------------------------------------------------`);
  console.log(`Diagnosing: [${c.name}] ${s.code} (${t.name})`);

  // Find all empty slots in this class
  const isJunior = c.name.startsWith('JS');
  const emptyInClass = [];
  for (const d of gen.days) {
    const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
    for (let p = startP; p <= maxP; p++) {
      if (!rep.slots.some(sl => sl.class_id === u.class_id && sl.day === d && sl.period_index === p)) {
        emptyInClass.push({ day: d, period: p });
      }
    }
  }

  console.log(`Empty lesson slots in ${c.name}:`, emptyInClass);

  for (const e of emptyInClass) {
    console.log(`\n  Checking empty slot: ${e.day} P${e.period}`);
    const can = gen._canPlaceSlot(u, e.day, e.period, rep.slots, classMap, teacherMap, subjectMap);
    console.log(`    _canPlaceSlot result: ${can}`);

    const tBusy = rep.slots.filter(sl => sl.teacher_id === tId && sl.day === e.day && sl.period_index === e.period);
    console.log(`    Teacher ${t.name} busy at ${e.day} P${e.period}?`, tBusy.map(sl => classMap[sl.class_id]?.name + ' ' + subjectMap[sl.subject_id]?.code));

    const sameSub = rep.slots.some(sl => sl.class_id === u.class_id && sl.subject_id === sId && sl.day === e.day);
    console.log(`    Same subject on ${e.day}?`, sameSub);

    const tDaySlots = rep.slots.filter(sl => sl.teacher_id === tId && sl.day === e.day);
    console.log(`    Teacher ${t.name} day load on ${e.day}: ${tDaySlots.length} periods`);
  }
}
