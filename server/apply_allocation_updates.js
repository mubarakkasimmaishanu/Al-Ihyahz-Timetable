import { db } from './db/database.js';

console.log('=== BEFORE UPDATE ===');
const before = db.prepare(`
  SELECT a.id, c.name as class_name, s.code, t.name as teacher_name, a.periods_per_week, a.allow_double
  FROM allocations a
  JOIN classes c ON a.class_id = c.id
  JOIN subjects s ON a.subject_id = s.id
  JOIN teachers t ON a.teacher_id = t.id
  WHERE (c.name = 'SS 1' AND s.code IN ('DPR', 'CIV'))
     OR (c.name = 'SS 2' AND s.code IN ('DPR', 'AGR'))
`).all();
console.table(before);

// Apply updates
// 1. SS 1 DPR: 3 -> 4 contacts, allow_double: 1
db.prepare(`
  UPDATE allocations 
  SET periods_per_week = 4, allow_double = 1
  WHERE class_id = (SELECT id FROM classes WHERE name = 'SS 1')
    AND subject_id = (SELECT id FROM subjects WHERE code = 'DPR')
`).run();

// 2. SS 2 DPR: 3 -> 4 contacts, allow_double: 1
db.prepare(`
  UPDATE allocations 
  SET periods_per_week = 4, allow_double = 1
  WHERE class_id = (SELECT id FROM classes WHERE name = 'SS 2')
    AND subject_id = (SELECT id FROM subjects WHERE code = 'DPR')
`).run();

// 3. SS 1 CIV: 4 -> 3 contacts, allow_double: 0
db.prepare(`
  UPDATE allocations 
  SET periods_per_week = 3, allow_double = 0
  WHERE class_id = (SELECT id FROM classes WHERE name = 'SS 1')
    AND subject_id = (SELECT id FROM subjects WHERE code = 'CIV')
`).run();

// 4. SS 2 AGR: 4 -> 3 contacts, allow_double: 0
db.prepare(`
  UPDATE allocations 
  SET periods_per_week = 3, allow_double = 0
  WHERE class_id = (SELECT id FROM classes WHERE name = 'SS 2')
    AND subject_id = (SELECT id FROM subjects WHERE code = 'AGR')
`).run();

console.log('=== AFTER UPDATE ===');
const after = db.prepare(`
  SELECT a.id, c.name as class_name, s.code, t.name as teacher_name, a.periods_per_week, a.allow_double
  FROM allocations a
  JOIN classes c ON a.class_id = c.id
  JOIN subjects s ON a.subject_id = s.id
  JOIN teachers t ON a.teacher_id = t.id
  WHERE (c.name = 'SS 1' AND s.code IN ('DPR', 'CIV'))
     OR (c.name = 'SS 2' AND s.code IN ('DPR', 'AGR'))
`).all();
console.table(after);

// Total weekly contacts check
const totalAllocatedPeriods = db.prepare(`SELECT SUM(periods_per_week) as total FROM allocations`).get();
console.log(`Total School-Wide Allocated Periods: ${totalAllocatedPeriods.total}`);

// Teacher weekly loads check
const teacherLoads = db.prepare(`
  SELECT t.name, SUM(a.periods_per_week) as total_periods
  FROM teachers t
  JOIN allocations a ON a.teacher_id = t.id
  GROUP BY t.id, t.name
  ORDER BY t.name
`).all();
console.table(teacherLoads);
