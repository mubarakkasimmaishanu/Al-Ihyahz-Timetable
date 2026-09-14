import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

let slots = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

const s1 = slots.find(s => s.class_name === 'SS 2' && s.day === 'Friday' && s.period_index === 2 && s.subject_name.includes('MATHS'));
const s2 = slots.find(s => s.class_name === 'SS 2' && s.day === 'Thursday' && s.period_index === 6 && s.subject_name.includes('ENG'));

const sim = slots.map(r => {
  if (r.id === s1.id) return { ...r, day: s2.day, period_index: s2.period_index };
  if (r.id === s2.id) return { ...r, day: s1.day, period_index: s1.period_index };
  return r;
});

// Check SS 2 Friday subjects:
console.log('SS 2 Friday subjects:');
sim.filter(r => r.class_name === 'SS 2' && r.day === 'Friday').forEach(r => console.log(`  P${r.period_index}: ${r.subject_name} (${r.teacher_name})`));

// Check SS 2 Maths distribution:
console.log('\nSS 2 Maths slots (Yusuf):');
sim.filter(r => r.class_name === 'SS 2' && r.subject_name.includes('MATHS')).forEach(r => console.log(`  ${r.day} P${r.period_index}`));

// Check SS 2 English distribution (Sumayya):
console.log('\nSS 2 English slots (Sumayya):');
sim.filter(r => r.class_name === 'SS 2' && r.subject_name.includes('ENG')).forEach(r => console.log(`  ${r.day} P${r.period_index}`));

// Check Friday heavy subjects per class:
const heavyList = ['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO'];
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];
console.log('\nFriday heavy subject counts per class:');
for (const c of classes) {
  const friHeavy = sim.filter(r => r.class_name === c && r.day === 'Friday' && heavyList.some(h => r.subject_name.includes(h)));
  console.log(`  ${c}: ${friHeavy.length} periods (${friHeavy.map(r => `P${r.period_index} ${r.subject_name}`).join(', ')})`);
}
