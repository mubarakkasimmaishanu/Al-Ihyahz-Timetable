import { db } from './db/database.js';

console.log('=== APPLYING JUNIOR 34-PERIOD / 246 TOTAL CONTACTS UPDATES ===');

// 1. Ensure STP exists in subjects table
let stpSub = db.prepare("SELECT * FROM subjects WHERE code = 'STP'").get();
if (!stpSub) {
  db.prepare(`
    INSERT INTO subjects (name, code, category, color)
    VALUES ('STUDY / LIB', 'STP', 'General', '#64748b')
  `).run();
  stpSub = db.prepare("SELECT * FROM subjects WHERE code = 'STP'").get();
  console.log('Created STP subject in subjects table with ID:', stpSub.id);
} else {
  console.log('STP subject already exists with ID:', stpSub.id);
}

const yusuf = db.prepare("SELECT id FROM teachers WHERE name = 'M. Yusuf'").get();
const maryam = db.prepare("SELECT id FROM teachers WHERE name = 'M. Maryam'").get();
const irsSub = db.prepare("SELECT id FROM subjects WHERE code = 'IRS'").get();
const nvSub = db.prepare("SELECT id FROM subjects WHERE code = 'NV'").get();

const js1 = db.prepare("SELECT id FROM classes WHERE name = 'JS 1'").get();
const js2 = db.prepare("SELECT id FROM classes WHERE name = 'JS 2'").get();
const js3 = db.prepare("SELECT id FROM classes WHERE name = 'JS 3'").get();

// 2. Transfer JS 3 IRS to M. Yusuf
db.prepare(`
  UPDATE allocations 
  SET teacher_id = ?, periods_per_week = 3, allow_double = 0
  WHERE class_id = ? AND subject_id = ?
`).run(yusuf.id, js3.id, irsSub.id);
console.log('Transferred JS 3 IRS to M. Yusuf (3 periods).');

// 3. Update NV in JS 1, JS 2, JS 3 to 4 contacts (1 double + 2 singles) for M. Maryam
db.prepare(`
  UPDATE allocations 
  SET periods_per_week = 4, allow_double = 1
  WHERE subject_id = ? AND class_id IN (?, ?, ?)
`).run(nvSub.id, js1.id, js2.id, js3.id);
console.log('Updated NV to 4 contacts (1 double + 2 singles) across JS 1, JS 2, JS 3.');

// 4. Add STP in JS 1, JS 2, JS 3 for M. Yusuf (1 period each)
for (const cls of [js1, js2, js3]) {
  const existing = db.prepare(`
    SELECT * FROM allocations WHERE class_id = ? AND subject_id = ?
  `).get(cls.id, stpSub.id);

  if (existing) {
    db.prepare(`
      UPDATE allocations SET teacher_id = ?, periods_per_week = 1, allow_double = 0
      WHERE id = ?
    `).run(yusuf.id, existing.id);
  } else {
    db.prepare(`
      INSERT INTO allocations (class_id, subject_id, teacher_id, periods_per_week, allow_double)
      VALUES (?, ?, ?, 1, 0)
    `).run(cls.id, stpSub.id, yusuf.id);
  }
}
console.log('Added STP (Study / Library) in JS 1, JS 2, JS 3 for M. Yusuf (1 period each).');

// 5. Verification of total allocations
const totalPeriods = db.prepare('SELECT SUM(periods_per_week) as total FROM allocations').get();
console.log(`\n>>> TOTAL ALLOCATED PERIODS ACROSS SCHOOL: ${totalPeriods.total} <<<`);

// 6. Verification of Class Loads
const classLoads = db.prepare(`
  SELECT c.name, SUM(a.periods_per_week) as total_periods
  FROM classes c
  JOIN allocations a ON a.class_id = c.id
  GROUP BY c.id, c.name
  ORDER BY c.name
`).all();
console.log('\n=== CLASS ALLOCATIONS ===');
console.table(classLoads);

// 7. Verification of Teacher Loads
const teacherLoads = db.prepare(`
  SELECT t.name, SUM(a.periods_per_week) as total_periods
  FROM teachers t
  JOIN allocations a ON a.teacher_id = t.id
  GROUP BY t.id, t.name
  ORDER BY t.name
`).all();
console.log('\n=== TEACHER LOADS ===');
console.table(teacherLoads);
