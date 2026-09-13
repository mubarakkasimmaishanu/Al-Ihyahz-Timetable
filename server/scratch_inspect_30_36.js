import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 50 });

for (const targetRestart of [30, 36]) {
  console.log(`\n================ INSPECTING RESTART ${targetRestart} ================`);
  // Seed / loop to restart
  for (let r = 0; r <= targetRestart; r++) {
    const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
    if (r === targetRestart) {
      const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);
      console.log(`Restart ${r}: unplaced after repair: ${rep.unplaced.length}`);
      for (const u of rep.unplaced) {
        console.log('Unplaced unit:', classMap[u.class_id]?.name, subjectMap[(u.alloc||u.allocA)?.subject_id]?.code, teacherMap[(u.alloc||u.allocA)?.teacher_id]?.name);
      }
      // Check empty slots in that class
      const targetClassId = rep.unplaced[0]?.class_id;
      if (targetClassId) {
        const cls = classMap[targetClassId];
        const isJunior = cls.name?.startsWith('JS');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        for (const d of days) {
          const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
          const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
          for (let p = startP; p <= maxP; p++) {
            const occ = rep.slots.filter(s => s.class_id === targetClassId && s.day === d && s.period_index === p);
            if (occ.length === 0) {
              console.log(`  Empty slot in ${cls.name}: ${d} P${p}`);
            }
          }
        }
      }
    }
  }
}
