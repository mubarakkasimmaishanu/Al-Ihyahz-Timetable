import { db } from './db/database.js';

const shehu = db.prepare("SELECT * FROM teachers WHERE name LIKE '%Shehu%'").get();
const allocs = db.prepare(`
  SELECT a.*, c.name as class_name, s.code as subject_code 
  FROM allocations a 
  JOIN classes c ON a.class_id = c.id 
  JOIN subjects s ON a.subject_id = s.id 
  WHERE a.teacher_id = ?
`).all(shehu.id);

console.log('M. Shehu allocations:');
for (const a of allocs) {
  console.log(`[${a.class_name}] ${a.subject_code}: ${a.periods_per_week}p (allow_double=${a.allow_double})`);
}
console.log('Total:', allocs.reduce((s,a) => s + a.periods_per_week, 0));
