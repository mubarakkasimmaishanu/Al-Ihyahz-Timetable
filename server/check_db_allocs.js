import { db } from './db/database.js';

const allocs = db.prepare(`
  SELECT a.id, c.name as class_name, s.code as sub_code, s.name as sub_name, t.name as teacher_name, a.periods_per_week, a.allow_double
  FROM allocations a
  JOIN classes c ON a.class_id = c.id
  JOIN subjects s ON a.subject_id = s.id
  JOIN teachers t ON a.teacher_id = t.id
  ORDER BY c.name, s.code
`).all();

const totalPeriods = allocs.reduce((sum, a) => sum + a.periods_per_week, 0);
console.log('Total allocated periods in DB:', totalPeriods);

const teacherLoads = {};
const classLoads = {};
for (const a of allocs) {
  teacherLoads[a.teacher_name] = (teacherLoads[a.teacher_name] || 0) + a.periods_per_week;
  classLoads[a.class_name] = (classLoads[a.class_name] || 0) + a.periods_per_week;
}

console.log('\n--- CLASS LOADS ---');
console.table(classLoads);

console.log('\n--- TEACHER LOADS ---');
console.table(teacherLoads);
