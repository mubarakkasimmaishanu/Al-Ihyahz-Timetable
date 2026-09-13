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
const repaired = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

for (const u of repaired.unplaced) {
  const c = classMap[u.class_id]?.name;
  const t = teacherMap[(u.alloc || u.allocA).teacher_id]?.name;
  const s = subjectMap[(u.alloc || u.allocA).subject_id]?.code;
  console.log(`\nDiagnosing remaining unplaced: [${c}] ${s} (${t})`);

  // Find all slots of this class
  const cSlots = repaired.slots.filter(sl => sl.class_id === u.class_id);
  console.log(`Total slots placed in class ${c}: ${cSlots.length}`);
  
  // Print empty periods in this class across the week
  for (const d of gen.days) {
    const isJunior = c.startsWith('JS');
    const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
    const emptyOnDay = [];
    for (let p = startP; p <= maxP; p++) {
      if (!cSlots.some(sl => sl.day === d && sl.period_index === p)) {
        emptyOnDay.push(p);
      }
    }
    if (emptyOnDay.length > 0) {
      console.log(`  Empty on ${d}: periods [${emptyOnDay.join(', ')}]`);
      for (const p of emptyOnDay) {
        const can = gen._canPlaceSlot(u, d, p, repaired.slots, classMap, teacherMap, subjectMap);
        console.log(`    Can place at ${d} P${p}? ${can}`);
        if (!can) {
          const tId = (u.alloc || u.allocA).teacher_id;
          const sId = (u.alloc || u.allocA).subject_id;
          const tBusy = repaired.slots.some(sl => sl.teacher_id === tId && sl.day === d && sl.period_index === p);
          const sameSub = repaired.slots.some(sl => sl.class_id === u.class_id && sl.subject_id === sId && sl.day === d);
          const tDayCount = repaired.slots.filter(sl => sl.teacher_id === tId && sl.day === d).length;
          console.log(`      -> tBusy=${tBusy}, sameSub=${sameSub}, tDayCount=${tDayCount}`);
        }
      }
    }
  }
}
