import { db } from './db/database.js';

console.log('--- Updating Junior Secondary Allocations in SQLite Database ---');

// 1. Get teacher IDs
const teachers = db.prepare('SELECT * FROM teachers').all();
const yusuf = teachers.find(t => t.name.includes('Yusuf'));
const maryam = teachers.find(t => t.name.includes('Maryam'));
const nabila = teachers.find(t => t.name.includes('Nabila'));

console.log(`M. Yusuf ID: ${yusuf.id}`);
console.log(`M. Maryam ID: ${maryam.id}`);
console.log(`M. Nabila ID: ${nabila.id}`);

// 2. Get subjects
const subjects = db.prepare('SELECT * FROM subjects').all();
const irs = subjects.find(s => s.code === 'IRS');
const nv = subjects.find(s => s.code === 'NV');

// 3. Get classes
const classes = db.prepare('SELECT * FROM classes').all();
const js1 = classes.find(c => c.name === 'JS 1');
const js2 = classes.find(c => c.name === 'JS 2');
const js3 = classes.find(c => c.name === 'JS 3');

// Update JS 3 IRS: reassign to M. Yusuf, 4 contacts, allow_double = 1
db.prepare(`
  UPDATE allocations 
  SET teacher_id = ?, periods_per_week = 4, allow_double = 1 
  WHERE class_id = ? AND subject_id = ?
`).run(yusuf.id, js3.id, irs.id);
console.log('Updated JS 3 IRS -> M. Yusuf (4 contacts, 1 double + 2 singles)');

// Update JS 1 IRS: assign to M. Yusuf, 4 contacts, allow_double = 1
db.prepare(`
  UPDATE allocations 
  SET teacher_id = ?, periods_per_week = 4, allow_double = 1 
  WHERE class_id = ? AND subject_id = ?
`).run(yusuf.id, js1.id, irs.id);
console.log('Updated JS 1 IRS -> M. Yusuf (4 contacts, 1 double + 2 singles)');

// Update JS 2 IRS: under M. Nabila, 4 contacts, allow_double = 1
db.prepare(`
  UPDATE allocations 
  SET teacher_id = ?, periods_per_week = 4, allow_double = 1 
  WHERE class_id = ? AND subject_id = ?
`).run(nabila.id, js2.id, irs.id);
console.log('Updated JS 2 IRS -> M. Nabila (4 contacts, 1 double + 2 singles)');

// Update NV (National Values) for JS 1, JS 2, JS 3: 4 contacts each under M. Maryam, allow_double = 1
for (const c of [js1, js2, js3]) {
  db.prepare(`
    UPDATE allocations 
    SET teacher_id = ?, periods_per_week = 4, allow_double = 1 
    WHERE class_id = ? AND subject_id = ?
  `).run(maryam.id, c.id, nv.id);
  console.log(`Updated ${c.name} NV -> M. Maryam (4 contacts, 1 double + 2 singles)`);
}

// Audit all allocations now
const allocs = db.prepare(`
  SELECT a.*, c.name as class_name, s.code as subject_code, t.name as teacher_name
  FROM allocations a
  JOIN classes c ON a.class_id = c.id
  JOIN subjects s ON a.subject_id = s.id
  JOIN teachers t ON a.teacher_id = t.id
  ORDER BY c.name, s.code
`).all();

console.log('\n--- VERIFIED JUNIOR ALLOCATIONS ---');
allocs.filter(a => a.class_name.startsWith('JS')).forEach(a => {
  console.log(`[${a.class_name}] ${a.subject_code.padEnd(6)}: ${a.periods_per_week}p (double=${a.allow_double}) -> ${a.teacher_name}`);
});

console.log('\n--- VERIFIED TEACHER TOTAL LOADS ---');
teachers.forEach(t => {
  const tAllocs = allocs.filter(a => a.teacher_id === t.id);
  const total = tAllocs.reduce((s, a) => s + a.periods_per_week, 0);
  console.log(`${t.name.padEnd(20)}: ${total} periods`);
});

console.log('\n--- VERIFIED CLASS TOTAL PERIODS ---');
classes.forEach(c => {
  const cAllocs = allocs.filter(a => a.class_id === c.id);
  const total = cAllocs.reduce((s, a) => s + a.periods_per_week, 0);
  console.log(`${c.name.padEnd(10)}: ${total} periods`);
});

console.log('\nTotal all allocations:', allocs.reduce((s, a) => s + a.periods_per_week, 0));
