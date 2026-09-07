import { db } from './db/database.js';

const slots = db.prepare(`
  SELECT ts.day, ts.period_index, c.name as class_name, s.name as subject_name, t.name as teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE t.name = 'M. Zainab Kabir'
  ORDER BY CASE ts.day
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
  END, ts.period_index ASC
`).all();

console.log('Total Zainab slots in DB:', slots.length);
console.table(slots);

// Check per day distribution
const dayCounts = {};
let fridayCount = 0;
let morningCount = 0;
let afternoonCount = 0;

for (const s of slots) {
  dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
  if (s.day === 'Friday') fridayCount++;
  if (s.period_index <= 4) morningCount++;
  else afternoonCount++;
}

console.log('\nDay Distribution:', dayCounts);
console.log(`Friday Slots: ${fridayCount} (MUST BE 0)`);
console.log(`Morning (P1-P4): ${morningCount}, Afternoon (P5-P8): ${afternoonCount}`);

// Check class breakdowns
for (const cls of ['JS 1', 'JS 2', 'JS 3']) {
  const clsSlots = slots.filter(s => s.class_name === cls);
  console.log(`\n=== ${cls} Slots (${clsSlots.length}) ===`);
  const eng = clsSlots.filter(s => s.subject_name === 'ENG');
  const bus = clsSlots.filter(s => s.subject_name === 'BUS');
  console.log(`  ENG: ${eng.length} periods, days:`, eng.map(s => `${s.day} P${s.period_index}`).join(', '));
  console.log(`  BUS: ${bus.length} periods, days:`, bus.map(s => `${s.day} P${s.period_index}`).join(', '));
}
