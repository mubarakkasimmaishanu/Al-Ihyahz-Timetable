import { db } from './db/database.js';

for (const c of ['SS 1', 'SS 2', 'SS 3', 'JS 1', 'JS 2', 'JS 3']) {
  const cls = db.prepare('SELECT id FROM classes WHERE name = ?').get(c);
  const allocs = db.prepare(`
    SELECT s.name, s.code, a.periods_per_week, t.name as teacher_name
    FROM allocations a
    JOIN subjects s ON s.id = a.subject_id
    JOIN teachers t ON t.id = a.teacher_id
    WHERE a.class_id = ?
    ORDER BY s.code
  `).all(cls.id);
  const total = allocs.reduce((s, a) => s + a.periods_per_week, 0);
  console.log(`=== ${c} (Total Allocations: ${total}) ===`);
  allocs.forEach(a => console.log(`  ${a.code.padEnd(6)} ${a.name.padEnd(28)} ${a.periods_per_week}p (${a.teacher_name})`));
}
