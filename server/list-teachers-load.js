import { db } from './db/database.js';

const teachers = db.prepare('SELECT * FROM teachers ORDER BY id').all();

console.log('========================================================================');
console.log('         AL-IHYAZ ACADEMY: TEACHERS, SUBJECTS & WORKLOAD');
console.log('========================================================================\n');

let grandTotal = 0;

for (const t of teachers) {
  const allocs = db.prepare(`
    SELECT s.name AS subject_name, s.code AS subject_code, c.name AS class_name, a.periods_per_week
    FROM allocations a
    JOIN subjects s ON s.id = a.subject_id
    JOIN classes c ON c.id = a.class_id
    WHERE a.teacher_id = ?
    ORDER BY s.name, c.name
  `).all(t.id);

  const total = allocs.reduce((sum, a) => sum + a.periods_per_week, 0);
  grandTotal += total;

  console.log(`TEACHER: ${t.name} (Code: ${t.code})`);
  console.log(`  Phone: ${t.phone || 'N/A'} | Time Pref: ${t.time_preference || 'ANY'} | Unav Days: ${t.unavailable_days || 'None'}`);
  console.log(`  Total Weekly Load: ${total} periods`);
  console.log(`  Allocations (${allocs.length}):`);
  
  // Group by subject
  const subjectGroups = {};
  for (const a of allocs) {
    if (!subjectGroups[a.subject_name]) {
      subjectGroups[a.subject_name] = [];
    }
    subjectGroups[a.subject_name].push(`${a.class_name} (${a.periods_per_week}p)`);
  }

  for (const [sub, classList] of Object.entries(subjectGroups)) {
    const subTotal = allocs.filter(a => a.subject_name === sub).reduce((s, a) => s + a.periods_per_week, 0);
    console.log(`    - ${sub} [${subTotal}p]: ${classList.join(', ')}`);
  }
  console.log('');
}

console.log(`========================================================================`);
console.log(`GRAND TOTAL WEEKLY CONTACTS ACROSS ALL TEACHERS: ${grandTotal} periods`);
console.log(`========================================================================`);
