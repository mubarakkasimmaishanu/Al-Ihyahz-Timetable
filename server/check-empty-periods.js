import { db } from './db/database.js';

const classes = db.prepare('SELECT * FROM classes ORDER BY id').all();
const slots = db.prepare(`
  SELECT ts.class_id, ts.day, ts.period_index, s.code AS subject_code, s.name AS subject_name, t.name AS teacher_name
  FROM timetable_slots ts
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  ORDER BY ts.class_id, ts.day, ts.period_index
`).all();

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

console.log('========================================================================');
console.log('         SCHEDULE & EMPTY PERIODS AUDIT PER CLASS');
console.log('========================================================================\n');

for (const cls of classes) {
  console.log(`\n------------------------------------------------------------------------`);
  console.log(`CLASS: ${cls.name} (${cls.level})`);
  console.log(`------------------------------------------------------------------------`);
  
  let totalClassSlots = 0;
  let totalEmptySlots = 0;
  let totalGaps = 0;

  for (const day of days) {
    const maxP = (day === 'Friday') ? 6 : 8;
    const daySlots = slots.filter(s => s.class_id === cls.id && s.day === day);
    const occupiedPeriods = new Set(daySlots.map(s => s.period_index));
    
    // Find empty periods
    const emptyPeriods = [];
    for (let p = 1; p <= maxP; p++) {
      if (!occupiedPeriods.has(p)) {
        emptyPeriods.push(p);
      }
    }

    // Check for internal holes/gaps: an empty period with occupied periods after it
    const lastOccupied = Math.max(0, ...daySlots.map(s => s.period_index));
    const internalGaps = emptyPeriods.filter(p => p < lastOccupied);

    totalClassSlots += daySlots.length;
    totalEmptySlots += emptyPeriods.length;
    totalGaps += internalGaps.length;

    // Period by period layout
    const periodLayout = [];
    for (let p = 1; p <= maxP; p++) {
      const slot = daySlots.find(s => s.period_index === p);
      if (slot) {
        periodLayout.push(`P${p}: ${slot.subject_code} (${slot.teacher_name.split(' ').pop()})`);
      } else {
        periodLayout.push(`P${p}: [FREE]`);
      }
    }

    console.log(`  ${day.padEnd(9)} | Slots: ${daySlots.length}/${maxP} | Empty: ${emptyPeriods.length ? emptyPeriods.map(p => `P${p}`).join(', ') : 'None'}${internalGaps.length ? ` | ⚠️ INTERNAL GAPS: ${internalGaps.map(p => `P${p}`).join(', ')}` : ''}`);
    console.log(`    Layout: ${periodLayout.join(' | ')}`);
  }
  console.log(`  >> Total Placed Periods: ${totalClassSlots}`);
  console.log(`  >> Total Free Periods in Week: ${totalEmptySlots}`);
  console.log(`  >> Internal Gap Warnings: ${totalGaps}`);
}
