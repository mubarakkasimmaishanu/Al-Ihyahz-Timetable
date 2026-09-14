import { db } from './db/database.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const slots = db.prepare('SELECT * FROM timetable_slots').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

console.log('Total slots in DB:', slots.length);

// 1. Issue 1: M. Nabila Period 8 slots
console.log('\n=== ISSUE 1: PERIOD 8 BY TEACHER ===');
for (const t of teachers) {
  const tP8 = slots.filter(s => s.teacher_id === t.id && s.period_index === 8);
  console.log(`  ${t.name.padEnd(20)}: ${tP8.length} slots (${tP8.map(s => s.day.substring(0,3) + ' [' + classMap[s.class_id].name + ' ' + subjectMap[s.subject_id].code + ']').join(', ')})`);
}

// 2. Issue 2: Teacher teaching two doubles without break
console.log('\n=== ISSUE 2: TEACHER TEACHING TWO DOUBLES WITHOUT BREAK ===');
// A double period is two adjacent slots with the same class_id, subject_id, teacher_id, day (p, p+1).
// Let's find all double periods for each teacher:
for (const t of teachers) {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    const tDaySlots = slots.filter(s => s.teacher_id === t.id && s.day === day).sort((a,b) => a.period_index - b.period_index);
    // Find runs:
    const periods = tDaySlots.map(s => s.period_index);
    // Check if there are 4 consecutive periods (e.g. 1,2,3,4 or 5,6,7,8)
    for (let p = 1; p <= 5; p++) {
      if (periods.includes(p) && periods.includes(p+1) && periods.includes(p+2) && periods.includes(p+3)) {
        const s1 = tDaySlots.find(s => s.period_index === p);
        const s2 = tDaySlots.find(s => s.period_index === p+1);
        const s3 = tDaySlots.find(s => s.period_index === p+2);
        const s4 = tDaySlots.find(s => s.period_index === p+3);
        console.log(`  ALERT: ${t.name} on ${day} teaches 4 consecutive periods (P${p}-P${p+3})!`);
        console.log(`    P${p}: [${classMap[s1.class_id].name}] ${subjectMap[s1.subject_id].code}`);
        console.log(`    P${p+1}: [${classMap[s2.class_id].name}] ${subjectMap[s2.subject_id].code}`);
        console.log(`    P${p+2}: [${classMap[s3.class_id].name}] ${subjectMap[s3.subject_id].code}`);
        console.log(`    P${p+3}: [${classMap[s4.class_id].name}] ${subjectMap[s4.subject_id].code}`);
      }
    }
  }
}

// 3. Issue 3: Teacher finished a class then a class again with another subject
console.log('\n=== ISSUE 3: TEACHER FINISHING A CLASS THEN TEACHING SAME CLASS AGAIN WITH ANOTHER SUBJECT ===');
// Check: same class, same teacher, adjacent periods (p and p+1), but DIFFERENT subject!
for (const cls of classes) {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    const cDaySlots = slots.filter(s => s.class_id === cls.id && s.day === day).sort((a,b) => a.period_index - b.period_index);
    for (let i = 0; i < cDaySlots.length; i++) {
      for (let j = i + 1; j < cDaySlots.length; j++) {
        const s1 = cDaySlots[i];
        const s2 = cDaySlots[j];
        if (s1.period_index + 1 === s2.period_index && s1.teacher_id === s2.teacher_id) {
          if (s1.subject_id !== s2.subject_id) {
            console.log(`  SAME CLASS, ADJACENT, DIFFERENT SUBJECT:`);
            console.log(`    Class: ${cls.name}, Day: ${day}`);
            console.log(`    Teacher: ${teacherMap[s1.teacher_id].name}`);
            console.log(`    P${s1.period_index}: ${subjectMap[s1.subject_id].code} -> P${s2.period_index}: ${subjectMap[s2.subject_id].code}`);
          }
        }
      }
    }
  }
}

// 4. Also check: In a class, does a class have two double periods back to back by ANY teacher?
console.log('\n=== ISSUE 4: A CLASS HAVING TWO DOUBLE PERIODS BACK TO BACK ===');
for (const cls of classes) {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    const cDaySlots = slots.filter(s => s.class_id === cls.id && s.day === day).sort((a,b) => a.period_index - b.period_index);
    // Check if P1-P2 is double and P3-P4 is double
    const isDouble = (pA, pB) => {
      const matchA = cDaySlots.filter(s => s.period_index === pA);
      const matchB = cDaySlots.filter(s => s.period_index === pB);
      if (matchA.length !== matchB.length || matchA.length === 0) return false;
      return matchA.every(ma => matchB.some(mb => mb.subject_id === ma.subject_id && mb.teacher_id === ma.teacher_id));
    };
    if (isDouble(1, 2) && isDouble(3, 4)) {
      console.log(`  Class ${cls.name} on ${day} has Double (P1-P2) + Double (P3-P4) in morning before break:`);
      console.log(`    P1-P2: ${cDaySlots.filter(s=>s.period_index===1).map(s=>subjectMap[s.subject_id].code + '(' + teacherMap[s.teacher_id].name + ')').join('/')}`);
      console.log(`    P3-P4: ${cDaySlots.filter(s=>s.period_index===3).map(s=>subjectMap[s.subject_id].code + '(' + teacherMap[s.teacher_id].name + ')').join('/')}`);
    }
    if (isDouble(5, 6) && isDouble(7, 8)) {
      console.log(`  Class ${cls.name} on ${day} has Double (P5-P6) + Double (P7-P8) in afternoon after break:`);
      console.log(`    P5-P6: ${cDaySlots.filter(s=>s.period_index===5).map(s=>subjectMap[s.subject_id].code + '(' + teacherMap[s.teacher_id].name + ')').join('/')}`);
      console.log(`    P7-P8: ${cDaySlots.filter(s=>s.period_index===7).map(s=>subjectMap[s.subject_id].code + '(' + teacherMap[s.teacher_id].name + ')').join('/')}`);
    }
  }
}
