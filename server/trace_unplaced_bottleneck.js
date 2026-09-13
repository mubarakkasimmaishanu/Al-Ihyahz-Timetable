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

console.log(`Placed: ${res.slots?.length}, Unplaced: ${res.unplacedUnits?.length}`);

for (const u of res.unplacedUnits || []) {
  const c = classMap[u.class_id]?.name;
  const tId = (u.alloc || u.allocA).teacher_id;
  const sId = (u.alloc || u.allocA).subject_id;
  const t = teacherMap[tId]?.name;
  const s = subjectMap[sId]?.code;
  console.log(`\n=== Unplaced Unit: [${c}] ${s} (${t}) duration=${u.duration} isPaired=${u.isPaired} ===`);

  // Check every single day and period
  for (const d of gen.days) {
    const isJunior = c.startsWith('JS');
    const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;

    for (let p = startP; p <= maxP; p++) {
      const p2 = u.duration === 2 ? p + 1 : null;
      if (u.duration === 2 && p >= maxP) continue;

      // Why couldn't it be placed at d, p?
      const cSlot1 = res.slots.some(sl => sl.class_id === u.class_id && sl.day === d && sl.period_index === p);
      const cSlot2 = p2 ? res.slots.some(sl => sl.class_id === u.class_id && sl.day === d && sl.period_index === p2) : false;

      const tSlot1 = res.slots.some(sl => sl.teacher_id === tId && sl.day === d && sl.period_index === p);
      const tSlot2 = p2 ? res.slots.some(sl => sl.teacher_id === tId && sl.day === d && sl.period_index === p2) : false;

      const sameSub = res.slots.some(sl => sl.class_id === u.class_id && sl.subject_id === sId && sl.day === d);
      const tDayCount = res.slots.filter(sl => sl.teacher_id === tId && sl.day === d).length;

      if (!cSlot1 && !cSlot2) {
        console.log(`  Class ${c} is FREE on ${d} P${p}${p2 ? '-' + p2 : ''}:`);
        console.log(`    Teacher ${t} busy? tSlot1=${tSlot1}, tSlot2=${tSlot2}`);
        console.log(`    Same subject on day? ${sameSub}`);
        console.log(`    Teacher day load: ${tDayCount}`);
        const canPlace = gen._canPlaceSlot(u, d, p, res.slots, classMap, teacherMap, subjectMap);
        console.log(`    _canPlaceSlot result: ${canPlace}`);
      }
    }
  }
}
