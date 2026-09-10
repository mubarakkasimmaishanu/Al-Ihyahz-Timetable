import { db } from './db/database.js';

let slots = db.prepare(`
  SELECT s.*, c.name as class_name, sub.code as sub_code, sub.name as sub_name, t.name as teacher_name
  FROM timetable_slots s
  JOIN classes c ON s.class_id = c.id
  JOIN subjects sub ON s.subject_id = sub.id
  JOIN teachers t ON s.teacher_id = t.id
`).all();

function checkClashes(slotList) {
  const teacherClashes = [];
  const classClashes = [];
  for (let i = 0; i < slotList.length; i++) {
    for (let j = i + 1; j < slotList.length; j++) {
      const a = slotList[i];
      const b = slotList[j];
      if (a.day === b.day && a.period_index === b.period_index) {
        if (a.teacher_id === b.teacher_id) {
          teacherClashes.push({ a, b });
        }
        if (a.class_id === b.class_id) {
          const isPaired = (
            (a.sub_code === 'GOV' && b.sub_code === 'PHY') || (a.sub_code === 'PHY' && b.sub_code === 'GOV') ||
            (a.sub_code === 'CHM' && b.sub_code === 'ECO') || (a.sub_code === 'ECO' && b.sub_code === 'CHM') ||
            (a.sub_code === 'BIO' && b.sub_code === 'LIT') || (a.sub_code === 'LIT' && b.sub_code === 'BIO') ||
            (a.sub_code === 'LIT' && b.sub_code === 'CHM') || (a.sub_code === 'CHM' && b.sub_code === 'LIT') ||
            (a.sub_code === 'ECO' && b.sub_code === 'BIO') || (a.sub_code === 'BIO' && b.sub_code === 'ECO')
          );
          if (!isPaired) {
            classClashes.push({ a, b });
          }
        }
      }
    }
  }
  return { teacherClashes, classClashes };
}

console.log('--- Current slots: ' + slots.length + ' ---');

// 1. Fix JS 3 Wednesday gap:
// Slot IRS (M. Maryam) in JS 3 is at Wed P8. Move it to Wed P6!
const js3WedP8 = slots.find(s => s.class_name === 'JS 3' && s.day === 'Wednesday' && s.period_index === 8);
if (js3WedP8) {
  console.log(`Moving JS 3 Wed P8 (${js3WedP8.sub_code} w/ ${js3WedP8.teacher_name}) to Wed P6`);
  js3WedP8.period_index = 6;
}

// 2. Fix JS 2 Thursday P8:
// Slot in JS 2 Thursday P8 is CMP (M. Sumayya). Move it to Friday P4!
const js2ThuP8 = slots.find(s => s.class_name === 'JS 2' && s.day === 'Thursday' && s.period_index === 8);
if (js2ThuP8) {
  console.log(`Moving JS 2 Thu P8 (${js2ThuP8.sub_code} w/ ${js2ThuP8.teacher_name}) to Friday P4`);
  js2ThuP8.day = 'Friday';
  js2ThuP8.period_index = 4;
}

// 3. Fix JS 2 Friday P1:
// Need a slot in JS 2 for Friday P1 where teacher is free at Friday P1.
// At Friday P1: M. Mubarak and M. Nana Firdaus are free.
// In JS 2:
// Look at Tuesday P8: BUS (Zainab Kabir). Zainab Kabir cannot be in P8!
// Let's check Tuesday JS 2:
// P1 BST, P2 ENG, P3 CMP, P4 NV, P5 HAUSA, P6 PVS, P7 PVS, P8 BUS.
// If BST from Tuesday P1 moves to Friday P1:
// Then Tuesday JS 2 has P1 empty.
// ENG from P2 can slide to P1, CMP from P3 to P2, NV from P4 to P3, HAUSA from P5 to P4, PVS from P6 to P5, PVS from P7 to P6, BUS from P8 to P7!
// Then Tuesday JS 2 has P1-P7 full, and P8 is FREE!
// And Friday JS 2 has P1 BST, P2 HAUSA, P3 IRS, P4 CMP (100% full)!
const js2TueP1 = slots.find(s => s.class_name === 'JS 2' && s.day === 'Tuesday' && s.period_index === 1 && s.sub_code === 'BST');
if (js2TueP1) {
  console.log(`Moving JS 2 Tue P1 (BST w/ Firdaus) to Friday P1`);
  js2TueP1.day = 'Friday';
  js2TueP1.period_index = 1;

  // Slide Tuesday JS 2 periods P2-P8 forward to P1-P7
  for (let p = 2; p <= 8; p++) {
    const s = slots.find(x => x.class_name === 'JS 2' && x.day === 'Tuesday' && x.period_index === p);
    if (s) {
      s.period_index = p - 1;
    }
  }
}

// Check clashes
const cl = checkClashes(slots);
console.log(`\n=== VERIFICATION RESULTS ===`);
console.log(`Total slots: ${slots.length}`);
console.log(`Teacher clashes: ${cl.teacherClashes.length}`);
if (cl.teacherClashes.length > 0) {
  cl.teacherClashes.forEach(c => console.log(`  Teacher clash: ${c.a.teacher_name} on ${c.a.day} P${c.a.period_index} between ${c.a.class_name} and ${c.b.class_name}`));
}
console.log(`Class clashes: ${cl.classClashes.length}`);
if (cl.classClashes.length > 0) {
  cl.classClashes.forEach(c => console.log(`  Class clash: ${c.a.class_name} on ${c.a.day} P${c.a.period_index} between ${c.a.sub_code} and ${c.b.sub_code}`));
}

if (cl.teacherClashes.length === 0 && cl.classClashes.length === 0) {
  console.log('\nZERO CLASHES! Saving optimized schedule to database...');
  db.exec('DELETE FROM timetable_slots WHERE is_locked = 0;');
  const insert = db.prepare(`
    INSERT INTO timetable_slots (id, class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of slots) {
    insert.run(s.id, s.class_id, s.subject_id, s.teacher_id, s.day, s.period_index, s.is_locked);
  }
  console.log('Database updated successfully!');
}
