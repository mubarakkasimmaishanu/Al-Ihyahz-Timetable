import { db } from './db/database.js';

console.log('=== Checking Friday Slots Across All Classes ===');

const fridaySlots = db.prepare(`
  SELECT ts.period_index, c.name AS class_name, c.level AS class_level, s.name AS subject_name, s.code AS subject_code, t.name AS teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE ts.day = 'Friday'
  ORDER BY c.name, ts.period_index
`).all();

console.table(fridaySlots);

console.log('\n=== Friday After Break (P5 & P6) Breakdown ===');
const p5p6Slots = fridaySlots.filter(s => s.period_index >= 5);
console.table(p5p6Slots);

console.log('\n=== Empty Periods Per Class By Day ===');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const classes = db.prepare('SELECT id, name FROM classes ORDER BY name').all();

for (const c of classes) {
  console.log(`\n--- Class: ${c.name} ---`);
  for (const day of days) {
    const maxP = day === 'Friday' ? 6 : 8;
    const slots = db.prepare(`
      SELECT period_index, s.code AS subject_code, t.name AS teacher_name
      FROM timetable_slots ts
      JOIN subjects s ON s.id = ts.subject_id
      JOIN teachers t ON t.id = ts.teacher_id
      WHERE ts.class_id = ? AND ts.day = ?
      ORDER BY ts.period_index
    `).all(c.id, day);
    
    const filledPeriods = slots.map(s => s.period_index);
    const emptyPeriods = [];
    for (let p = 1; p <= maxP; p++) {
      if (!filledPeriods.includes(p)) {
        emptyPeriods.push(p);
      }
    }
    const slotDesc = slots.map(s => `P${s.period_index}:${s.subject_code}`).join(', ');
    console.log(`  ${day.padEnd(9)} (${slots.length}/${maxP}): [Filled: ${slotDesc}] | [Empty: ${emptyPeriods.join(', ') || 'None'}]`);
  }
}
