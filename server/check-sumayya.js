import { db } from './db/database.js';

const slots = db.prepare(`
  SELECT ts.day, ts.period_index, c.name as class_name, s.name as subject_name, t.name as teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE t.name = 'M. Sumayya'
  ORDER BY CASE ts.day
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
  END, ts.period_index ASC
`).all();

console.log('Total M. Sumayya slots in DB:', slots.length);
console.table(slots);

const dayCounts = {};
let morning = 0;
let afternoon = 0;
for (const s of slots) {
  dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
  if (s.period_index <= 4) morning++;
  else afternoon++;
}

console.log('Day Distribution:', dayCounts);
console.log(`Morning (P1-P4): ${morning}, Afternoon (P5-P8): ${afternoon}`);

console.log('\n--- English Language Slots (Check tired hours) ---');
const engSlots = slots.filter(s => s.subject_name === 'ENG');
console.table(engSlots.map(s => ({
  class: s.class_name,
  day: s.day,
  period: s.period_index,
  timing: s.period_index <= 4 ? 'Morning' : (s.period_index === 5 ? 'Right After Break' : 'Afternoon')
})));

console.log('\n--- Computer Studies Slots ---');
const compSlots = slots.filter(s => s.subject_name === 'COMP');
console.table(compSlots.map(s => ({
  class: s.class_name,
  day: s.day,
  period: s.period_index
})));
