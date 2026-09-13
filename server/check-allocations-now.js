import { db } from './db/database.js';

const rows = db.prepare(`
  SELECT a.id, c.name as class_name, s.name as subject_name, s.code as subject_code, t.name as teacher_name, a.periods_per_week, a.allow_double
  FROM allocations a
  JOIN classes c ON c.id = a.class_id
  JOIN subjects s ON s.id = a.subject_id
  JOIN teachers t ON t.id = a.teacher_id
  ORDER BY c.name, s.name
`).all();

console.log('Total allocations:', rows.length);
console.log('Total periods_per_week sum:', rows.reduce((s, r) => s + r.periods_per_week, 0));

// Class totals
const classTotals = {};
for (const r of rows) {
  classTotals[r.class_name] = (classTotals[r.class_name] || 0) + r.periods_per_week;
}
console.log('Class totals:', classTotals);

// Teacher totals
const teacherTotals = {};
for (const r of rows) {
  teacherTotals[r.teacher_name] = (teacherTotals[r.teacher_name] || 0) + r.periods_per_week;
}
console.log('Teacher totals:', teacherTotals);

console.log('\n--- Junior Allocations ---');
console.table(rows.filter(r => r.class_name.startsWith('JS')).map(r => ({
  class: r.class_name,
  subject: r.subject_code || r.subject_name,
  teacher: r.teacher_name,
  periods: r.periods_per_week,
  allow_double: r.allow_double
})));
