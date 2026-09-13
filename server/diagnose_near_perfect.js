import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ maxRestarts: 50 });

// Run until we find a restart with <= 1 unplaced
for (let r = 0; r < 50; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  if (res.unplacedUnits?.length > 0) {
    const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
    if (rep.unplacedCount <= 1) {
      console.log(`Found near-perfect restart ${r}: unplaced = ${rep.unplacedCount}`);
      for (const u of rep.unplaced) {
        const c = classMap[u.class_id]?.name;
        const s = subjectMap[(u.alloc||u.allocA).subject_id]?.code;
        const t = teacherMap[(u.alloc||u.allocA).teacher_id]?.name;
        console.log(`Unplaced: [${c}] ${s} (${t}) duration=${u.duration} isPaired=${u.isPaired}`);

        // Find empty slots in this class
        for (const d of gen.days) {
          for (let p = 1; p <= 8; p++) {
            if (!rep.slots.some(sl => sl.class_id === u.class_id && sl.day === d && sl.period_index === p)) {
              console.log(`  Empty slot in ${c}: ${d} P${p}`);
            }
          }
        }
      }
      break;
    }
  }
}
