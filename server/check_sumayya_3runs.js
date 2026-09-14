import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

let slots = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function evaluateSumayya(slotsList) {
  let threeRuns = [];
  let dayCounts = {};

  for (const d of days) {
    const dSlots = slotsList.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    dayCounts[d] = dSlots.length;
    const pSet = new Set(dSlots.map(s => s.period_index));

    // Check consecutive periods
    for (let p = 1; p <= 6; p++) {
      if (pSet.has(p) && pSet.has(p + 1) && pSet.has(p + 2)) {
        threeRuns.push(`${d} P${p}-P${p+2}`);
      }
    }
  }
  return { threeRuns, dayCounts };
}

console.log('Current Sumayya state:', evaluateSumayya(slots));
