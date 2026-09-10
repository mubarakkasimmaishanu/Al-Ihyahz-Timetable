import { db } from './db/database.js';

let slots = db.prepare(`
  SELECT s.*, c.name as class_name, sub.code as sub_code, sub.name as sub_name, t.name as teacher_name
  FROM timetable_slots s
  JOIN classes c ON s.class_id = c.id
  JOIN subjects sub ON s.subject_id = sub.id
  JOIN teachers t ON s.teacher_id = t.id
`).all();

function findSlot(cName, day, period, subCode = null) {
  return slots.find(s => s.class_name === cName && s.day === day && s.period_index === period && (!subCode || s.sub_code === subCode));
}

console.log('--- Inspecting exact slots on Monday and Friday ---');
console.log('JS 1 Monday slots:');
slots.filter(s => s.class_name === 'JS 1' && s.day === 'Monday')
  .sort((a,b) => a.period_index - b.period_index)
  .forEach(s => console.log(`  P${s.period_index}: ${s.sub_code} (${s.teacher_name}) [id=${s.id}]`));

console.log('JS 1 Wednesday slots:');
slots.filter(s => s.class_name === 'JS 1' && s.day === 'Wednesday')
  .sort((a,b) => a.period_index - b.period_index)
  .forEach(s => console.log(`  P${s.period_index}: ${s.sub_code} (${s.teacher_name}) [id=${s.id}]`));

console.log('Friday slots:');
slots.filter(s => s.day === 'Friday')
  .sort((a,b) => a.period_index - b.period_index)
  .forEach(s => console.log(`  ${s.class_name} P${s.period_index}: ${s.sub_code} (${s.teacher_name}) [id=${s.id}]`));
