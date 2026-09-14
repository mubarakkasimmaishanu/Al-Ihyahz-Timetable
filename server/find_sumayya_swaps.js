import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

const rows = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

// Look at M. Sumayya's weekly slots
console.log('M. Sumayya current slots:');
const sumayyaRows = rows.filter(r => r.teacher_name.includes('Sumayya'));
for (const r of sumayyaRows) {
  console.log(`${r.day} P${r.period_index}: ${r.class_name} ${r.subject_name}`);
}

// Check where Sumayya has consecutive periods
function getTeacherMaxConsecutive(teacherSlots) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let maxConsec = 0;
  let details = [];
  for (const day of days) {
    const dSlots = teacherSlots.filter(s => s.day === day).sort((a, b) => a.period_index - b.period_index);
    let run = 0;
    let lastP = -1;
    for (const s of dSlots) {
      if (s.period_index === lastP + 1) {
        run++;
      } else {
        run = 1;
      }
      lastP = s.period_index;
      if (run > maxConsec) maxConsec = run;
      if (run >= 4) {
        details.push(`${day} run of ${run} (ends P${s.period_index})`);
      }
    }
  }
  return { maxConsec, details };
}

console.log('\nSumayya consecutive status:', getTeacherMaxConsecutive(sumayyaRows));
