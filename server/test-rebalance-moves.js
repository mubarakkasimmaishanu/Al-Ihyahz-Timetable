import { db } from './db/database.js';

let slots = db.prepare(`
  SELECT s.*, c.name as class_name, sub.code as sub_code, sub.name as sub_name, t.name as teacher_name
  FROM timetable_slots s
  JOIN classes c ON s.class_id = c.id
  JOIN subjects sub ON s.subject_id = sub.id
  JOIN teachers t ON s.teacher_id = t.id
`).all();

function checkAllClashes(slotList) {
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

// 1. JS 1: Move slot 187 (CMP JS 1) from Mon P7 to Fri P4
const s187 = slots.find(s => s.id === 187);
if (s187) { s187.day = 'Friday'; s187.period_index = 4; }

// 2. JS 1: Move slot 139 (MTH JS 1) from Mon P4 to Fri P1
const s139 = slots.find(s => s.id === 139);
if (s139) { s139.day = 'Friday'; s139.period_index = 1; }

// 3. JS 1: Move slot 178 (BST JS 1) from Wed P5 to Fri P2
const s178 = slots.find(s => s.id === 178);
if (s178) { s178.day = 'Friday'; s178.period_index = 2; }

// 4. JS 1: Move slot 168 (BST JS 1) from Tue P3 to Fri P3
const s168 = slots.find(s => s.id === 168);
if (s168) { s168.day = 'Friday'; s168.period_index = 3; }

// 5. JS 1 Monday: Move Mon P8 (PVS slot 224) to Mon P4
const s224 = slots.find(s => s.id === 224);
if (s224) { s224.period_index = 4; }

// 6. JS 1 Wednesday: Slide P6 (CMP 186) to P5, and P7 (PVS 220) to P6
const s186 = slots.find(s => s.id === 186);
const s220 = slots.find(s => s.id === 220);
if (s186) { s186.period_index = 5; }
if (s220) { s220.period_index = 6; }

// 7. JS 1 Tuesday: P3 moved out.
// Tue had: P1 ENG, P2 ENG, P3 BST (now on Fri), P4 NV (slot 228), P5 HAUSA (slot 198), P6 HAUSA (slot 199), P7 NV (slot 229)
// Slide: NV 228 -> P3, HAUSA 198 -> P4, HAUSA 199 -> P5, NV 229 -> P6
const s228 = slots.find(s => s.id === 228);
const s198 = slots.find(s => s.id === 198);
const s199 = slots.find(s => s.id === 199);
const s229 = slots.find(s => s.id === 229);
if (s228) { s228.period_index = 3; }
if (s198) { s198.period_index = 4; }
if (s199) { s199.period_index = 5; }
if (s229) { s229.period_index = 6; }

// 8. JS 3: Move a BST slot to Friday P4!
// Where is JS 3 BST?
const js3BST = slots.filter(s => s.class_name === 'JS 3' && s.sub_code === 'BST');
console.log('JS 3 BST slots:', js3BST.map(s => `${s.id} on ${s.day} P${s.period_index}`));
// Pick slot 179 on Wed P3:
const s179 = js3BST.find(s => s.day === 'Wednesday');
if (s179) {
  s179.day = 'Friday';
  s179.period_index = 4;
  console.log(`Moved JS 3 BST slot ${s179.id} to Friday P4`);
}

// JS 3 Wed had P3 moved out.
// Wed had: P1 ENG, P2 ENG, P3 BST (moved), P4 MTH (slot 96), P5 BUS (slot 165), P6 BUS (slot 166), P7 CMP (slot 190)
// Slide: P4 MTH -> P3, P5 BUS -> P4, P6 BUS -> P5, P7 CMP -> P6
const s96 = slots.find(s => s.id === 96);
const s165 = slots.find(s => s.id === 165);
const s166 = slots.find(s => s.id === 166);
const s190 = slots.find(s => s.id === 190);
if (s96) { s96.period_index = 3; }
if (s165) { s165.period_index = 4; }
if (s166) { s166.period_index = 5; }
if (s190) { s190.period_index = 6; }

// Check all clashes now
const cl = checkAllClashes(slots);
console.log(`\n=== RESULTS AFTER MOVES ===`);
console.log(`Total slots: ${slots.length}`);
console.log(`Teacher clashes: ${cl.teacherClashes.length}`);
if (cl.teacherClashes.length > 0) {
  cl.teacherClashes.forEach(c => console.log(`  Teacher clash: ${c.a.teacher_name} on ${c.a.day} P${c.a.period_index} between ${c.a.class_name} and ${c.b.class_name}`));
}
console.log(`Class clashes: ${cl.classClashes.length}`);
if (cl.classClashes.length > 0) {
  cl.classClashes.forEach(c => console.log(`  Class clash: ${c.a.class_name} on ${c.a.day} P${c.a.period_index} between ${c.a.sub_code} and ${c.b.sub_code}`));
}

// Check Friday layout
console.log('\n=== FRIDAY LAYOUT ===');
['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'].forEach(c => {
  let row = (c + ': ').padEnd(8);
  for (let p = 1; p <= 4; p++) {
    const s = slots.filter(x => x.class_name === c && x.day === 'Friday' && x.period_index === p);
    if (s.length === 0) row += `P${p}:[FREE] `;
    else if (s.length === 1) row += `P${p}:[${s[0].sub_code}] `;
    else row += `P${p}:[${s.map(x => x.sub_code).join('/')}] `;
  }
  console.log(row);
});

// Check Monday layout
console.log('\n=== MONDAY LAYOUT ===');
['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'].forEach(c => {
  let row = (c + ': ').padEnd(8);
  for (let p = 1; p <= 8; p++) {
    const s = slots.filter(x => x.class_name === c && x.day === 'Monday' && x.period_index === p);
    if (s.length === 0) row += `P${p}:[   ] `;
    else if (s.length === 1) row += `P${p}:[${s[0].sub_code}] `;
    else row += `P${p}:[${s.map(x => x.sub_code).join('/')}] `;
  }
  console.log(row);
});

// Check Tuesday layout
console.log('\n=== TUESDAY LAYOUT ===');
['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'].forEach(c => {
  let row = (c + ': ').padEnd(8);
  for (let p = 1; p <= 8; p++) {
    const s = slots.filter(x => x.class_name === c && x.day === 'Tuesday' && x.period_index === p);
    if (s.length === 0) row += `P${p}:[   ] `;
    else if (s.length === 1) row += `P${p}:[${s[0].sub_code}] `;
    else row += `P${p}:[${s.map(x => x.sub_code).join('/')}] `;
  }
  console.log(row);
});

// Check Wednesday layout
console.log('\n=== WEDNESDAY LAYOUT ===');
['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'].forEach(c => {
  let row = (c + ': ').padEnd(8);
  for (let p = 1; p <= 8; p++) {
    const s = slots.filter(x => x.class_name === c && x.day === 'Wednesday' && x.period_index === p);
    if (s.length === 0) row += `P${p}:[   ] `;
    else if (s.length === 1) row += `P${p}:[${s[0].sub_code}] `;
    else row += `P${p}:[${s.map(x => x.sub_code).join('/')}] `;
  }
  console.log(row);
});

// Check Thursday layout
console.log('\n=== THURSDAY LAYOUT ===');
['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'].forEach(c => {
  let row = (c + ': ').padEnd(8);
  for (let p = 1; p <= 8; p++) {
    const s = slots.filter(x => x.class_name === c && x.day === 'Thursday' && x.period_index === p);
    if (s.length === 0) row += `P${p}:[   ] `;
    else if (s.length === 1) row += `P${p}:[${s[0].sub_code}] `;
    else row += `P${p}:[${s.map(x => x.sub_code).join('/')}] `;
  }
  console.log(row);
});
