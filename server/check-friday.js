import { db } from './db/database.js';

const slots = db.prepare(`
  SELECT ts.period_index, c.name as class_name, s.code as subject_code, s.name as subject_name, t.name as teacher_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  WHERE ts.day = 'Friday'
  ORDER BY c.name, ts.period_index
`).all();

const HEAVY_CODES = new Set(['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO']);
const byClass = {};
for (const s of slots) {
  if (!byClass[s.class_name]) byClass[s.class_name] = {};
  if (!byClass[s.class_name][s.period_index]) byClass[s.class_name][s.period_index] = [];
  byClass[s.class_name][s.period_index].push(`${s.subject_code} (${s.teacher_name})`);
}

console.log('========================================');
console.log('FRIDAY SCHEDULE (ALL CLASSES)');
console.log('========================================');

let totalSchoolHeavyOnFriday = 0;

for (const [cls, pMap] of Object.entries(byClass)) {
  console.log(`\n--- ${cls} ---`);
  let heavyCount = 0;
  for (const [p, list] of Object.entries(pMap)) {
    const isHeavy = list.some(str => [...HEAVY_CODES].some(hc => str.startsWith(hc)));
    if (isHeavy) {
      heavyCount++;
      totalSchoolHeavyOnFriday++;
    }
    console.log(`  Period ${p}: ${list.join(' | ')}  ${isHeavy ? '--> [HEAVY SCIENCE/ARTS]' : '[LIGHT/VOCATIONAL]'}`);
  }
  console.log(`  Summary: ${heavyCount} heavy period(s) out of 6.`);
}

console.log(`\nTotal Heavy Science/Art periods across the ENTIRE school on Friday: ${totalSchoolHeavyOnFriday}`);
