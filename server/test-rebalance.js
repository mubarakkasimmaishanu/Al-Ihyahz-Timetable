import { db } from './db/database.js';

let slots = db.prepare(`
  SELECT s.*, c.name as class_name, sub.code as sub_code, sub.name as sub_name, t.name as teacher_name
  FROM timetable_slots s
  JOIN classes c ON s.class_id = c.id
  JOIN subjects sub ON s.subject_id = sub.id
  JOIN teachers t ON s.teacher_id = t.id
`).all();

function isFree(teacherId, classId, day, period, excludeId = null) {
  const tBusy = slots.some(s => s.id !== excludeId && s.teacher_id === teacherId && s.day === day && s.period_index === period);
  const cBusy = slots.some(s => s.id !== excludeId && s.class_id === classId && s.day === day && s.period_index === period);
  return !tBusy && !cBusy;
}

const js1 = slots.filter(s => s.class_name === 'JS 1');
console.log('--- JS 1 slots available for Friday ---');
for (const s of js1) {
  for (let p = 1; p <= 4; p++) {
    if (isFree(s.teacher_id, s.class_id, 'Friday', p, s.id)) {
      console.log(`Slot ${s.id} ${s.sub_code} (${s.teacher_name}) currently on ${s.day} P${s.period_index} CAN DIRECTLY MOVE to Friday P${p}!`);
    }
  }
}
