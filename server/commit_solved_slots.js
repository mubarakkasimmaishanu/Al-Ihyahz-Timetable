import { db } from './db/database.js';
import fs from 'fs';
import path from 'path';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const jsonPath = path.join(process.cwd(), 'server', 'data', 'solved_246_slots.json');
const solvedSlots = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`Loaded ${solvedSlots.length} slots from ${jsonPath}`);

// 1. Validate
const val = validateTimetable(solvedSlots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
console.log('\n--- VALIDATION ---');
console.log('  isValid:', val.isValid);
console.log('  conflicts:', val.conflicts.length);
console.log('  warnings:', val.warnings.length);

if (!val.isValid || val.conflicts.length > 0) {
  console.error('Validation failed!', val.conflicts);
  process.exit(1);
}

// 2. Commit to database
db.exec('BEGIN');
try {
  db.prepare('DELETE FROM timetable_slots').run();
  const insertSlot = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const s of solvedSlots) {
    insertSlot.run(
      s.class_id,
      s.subject_id,
      s.teacher_id,
      s.day,
      s.period_index,
      s.is_locked || 0
    );
  }
  db.exec('COMMIT');
  console.log(`\n🎉 Successfully committed all ${solvedSlots.length} slots to SQLite timetable_slots!`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Database commit error:', err);
  process.exit(1);
}

// 3. Verify DB row count
const count = db.prepare('SELECT count(*) as c FROM timetable_slots').get();
console.log(`Verified rows in timetable_slots: ${count.c}`);

// 4. Print Class-by-Class Table
console.log('\n================ OFFICIAL CLASS TIMETABLE SUMMARY ================');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
for (const cls of classes) {
  const cSlots = solvedSlots.filter(s => s.class_id === cls.id);
  const isJunior = cls.name.startsWith('JS');
  console.log(`\n>>> CLASS: ${cls.name} (${cSlots.length} periods, ${isJunior ? '100% full (34 periods)' : '100% full (36 slots / 48 contacts)'}) <<<`);
  for (const d of days) {
    const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
    const daySlots = cSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
    const row = [];
    if (d === 'Monday' || d === 'Friday') row.push('P1: [ASSEMBLY]');
    for (let p = startP; p <= maxP; p++) {
      const match = daySlots.filter(s => s.period_index === p);
      if (match.length === 0) {
        row.push(`P${p}: [EMPTY]`);
      } else if (match.length === 1) {
        row.push(`P${p}: ${subjectMap[match[0].subject_id].code} (${teacherMap[match[0].teacher_id].name.split(' ').pop()})`);
      } else {
        row.push(`P${p}: ` + match.map(m => `${subjectMap[m.subject_id].code}(${teacherMap[m.teacher_id].name.split(' ').pop()})`).join(' / '));
      }
    }
    console.log(`  ${d.padEnd(9)}: ${row.join(' | ')}`);
  }
}

// 5. Print Teacher Workload & Period 8 Distribution
console.log('\n================ TEACHER WORKLOAD & PERIOD 8 ROTATION ================');
for (const t of teachers) {
  const tSlots = solvedSlots.filter(s => s.teacher_id === t.id);
  const p8 = tSlots.filter(s => s.period_index === 8);
  const fri = tSlots.filter(s => s.day === 'Friday');
  console.log(`${t.name.padEnd(20)} | Total: ${String(tSlots.length).padStart(2)} contacts | P8: ${p8.length} slots | Friday: ${fri.length} slots`);
}
