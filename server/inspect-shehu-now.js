import { db } from './db/database.js';

const shehu = db.prepare("SELECT * FROM teachers WHERE name = 'M. Shehu'").get();
const slots = db.prepare(`
  SELECT ts.day, ts.period_index, c.name AS class_name, s.name AS subject_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  WHERE ts.teacher_id = ?
  ORDER BY 
    CASE ts.day 
      WHEN 'Monday' THEN 1 
      WHEN 'Tuesday' THEN 2 
      WHEN 'Wednesday' THEN 3 
      WHEN 'Thursday' THEN 4 
      WHEN 'Friday' THEN 5 
    END, ts.period_index
`).all(shehu.id);

console.log('--- Current Slots for M. Shehu ---');
console.table(slots);
