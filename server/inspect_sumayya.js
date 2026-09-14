import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

const rows = db.prepare(`
  SELECT t.name as teacher_name, c.name as class_name, s.name as subject_name, ts.day, ts.period_index
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

console.log('Total timetable rows:', rows.length);

const sumayya = rows.filter(r => r.teacher_name.includes('Sumayya'));
console.log('M. Sumayya total assigned periods:', sumayya.length);

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

console.log('\n--- M. SUMAYYA SCHEDULE ---');
for (const day of days) {
  const dRows = sumayya.filter(r => r.day === day);
  const map = {};
  dRows.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
  const line = periods.map(p => map[p] ? ('[P' + p + ': ' + map[p] + ']') : ('[P' + p + ': ---]')).join(' ');
  console.log(day.padEnd(10) + ': ' + line);
}

// Check consecutive periods for Sumayya
console.log('\n--- M. SUMAYYA CONSECUTIVE RUNS ---');
for (const day of days) {
  const dRows = sumayya.filter(r => r.day === day).sort((a, b) => a.period_index - b.period_index);
  const assignedPeriods = dRows.map(r => r.period_index);
  console.log(`${day}: assigned periods = [${assignedPeriods.join(', ')}]`);
  
  // Find runs
  let currentRun = [];
  for (let p = 1; p <= 8; p++) {
    const item = dRows.find(r => r.period_index === p);
    if (item) {
      currentRun.push(`P${p} (${item.class_name} ${item.subject_name})`);
    } else {
      if (currentRun.length > 2) {
        console.log(`  ALERT: ${day} has run of ${currentRun.length} consecutive periods: ${currentRun.join(', ')}`);
      }
      currentRun = [];
    }
  }
  if (currentRun.length > 2) {
    console.log(`  ALERT: ${day} has run of ${currentRun.length} consecutive periods: ${currentRun.join(', ')}`);
  }
}

// Check all teachers for runs of 4 or more
console.log('\n--- ALL TEACHERS CONSECUTIVE RUNS (>= 4 periods) ---');
const allTeachers = [...new Set(rows.map(r => r.teacher_name))];
for (const tName of allTeachers) {
  for (const day of days) {
    const tRows = rows.filter(r => r.teacher_name === tName && r.day === day);
    let currentRun = [];
    for (let p = 1; p <= 8; p++) {
      const item = tRows.find(r => r.period_index === p);
      if (item) {
        currentRun.push(`P${p} (${item.class_name} ${item.subject_name})`);
      } else {
        if (currentRun.length >= 4) {
          console.log(`  ALERT: ${tName} on ${day} has ${currentRun.length} consecutive periods: ${currentRun.join(', ')}`);
        }
        currentRun = [];
      }
    }
    if (currentRun.length >= 4) {
      console.log(`  ALERT: ${tName} on ${day} has ${currentRun.length} consecutive periods: ${currentRun.join(', ')}`);
    }
  }
}
