import { db } from './db/database.js';

const classes = db.prepare("SELECT * FROM classes WHERE level = 'JS'").all();
const slots = db.prepare(`
  SELECT s.*, sub.code, sub.name as subject_name, t.name as teacher_name 
  FROM timetable_slots s 
  JOIN subjects sub ON s.subject_id=sub.id 
  JOIN teachers t ON s.teacher_id=t.id
  WHERE s.class_id IN (SELECT id FROM classes WHERE level = 'JS')
`).all();
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

console.log('================================================================================');
console.log('                     JUNIOR SECONDARY FREE / EMPTY PERIODS AUDIT');
console.log('================================================================================');

for (const c of classes) {
  console.log(`\n------------------------------ ${c.name} ------------------------------`);
  const cSlots = slots.filter(s => s.class_id === c.id);
  let totalLessons = cSlots.length;
  let emptyPeriodsList = [];

  for (const d of days) {
    const maxP = d === 'Friday' ? 6 : 8;
    const daySlots = cSlots.filter(s => s.day === d);
    const row = [];

    for (let p = 1; p <= maxP; p++) {
      if ((d === 'Monday' || d === 'Friday') && p === 1) {
        row.push('P1:ASSEMBLY');
      } else if (d === 'Friday' && p > 4) {
        row.push(`P${p}:DISMISSED`);
      } else {
        const sl = daySlots.find(s => s.period_index === p);
        if (sl) {
          row.push(`P${p}:${sl.code}`);
        } else {
          row.push(`P${p}:[FREE]`);
          emptyPeriodsList.push({ day: d, period: p });
        }
      }
    }
    console.log(d.padEnd(10) + ' | ' + row.join(' | '));
  }

  console.log(`\nSummary for ${c.name}:`);
  console.log(`- Total Lessons Taught: ${totalLessons} periods`);
  console.log(`- Academic Free Periods (Mon–Thu during school hours): ${emptyPeriodsList.length} periods`);
  for (const ep of emptyPeriodsList) {
    console.log(`  * ${ep.day} Period ${ep.period} (Closing/End-of-day Early Dismissal at 1:10 PM)`);
  }
  console.log(`- Friday Afternoon Early Dismissal: Period 5 & Period 6 (11:10 AM – 12:30 PM, closed for Juma'at)`);
  console.log(`- Assemblies (Mon P1 & Fri P1): 8:00 – 8:40 AM`);
}
