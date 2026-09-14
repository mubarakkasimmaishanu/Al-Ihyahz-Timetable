import { db } from './db/database.js';
import fs from 'fs';

const slots = JSON.parse(fs.readFileSync('./server/data/solved_246_slots.json', 'utf8'));
const teachers = Object.fromEntries(db.prepare('SELECT id, name FROM teachers').all().map(t => [t.id, t.name]));
const subjects = Object.fromEntries(db.prepare('SELECT id, code, name FROM subjects').all().map(s => [s.id, s.code]));
const classes = Object.fromEntries(db.prepare('SELECT id, name FROM classes').all().map(c => [c.id, c.name]));

console.log('=== P8 COUNT BY TEACHER ===');
const p8Count = {};
for (const s of slots.filter(x => x.period_index === 8)) {
  const t = teachers[s.teacher_id];
  p8Count[t] = (p8Count[t] || 0) + 1;
}
console.log(p8Count);

console.log('\n=== CHECK TWO DOUBLES WITHOUT BREAK FOR TEACHERS ===');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
for (const tId of Object.keys(teachers)) {
  const tName = teachers[tId];
  for (const d of days) {
    const tSlots = slots.filter(s => s.teacher_id === Number(tId) && s.day === d);
    const doubles = [];
    for (let p = 1; p <= 7; p++) {
      const s1 = tSlots.find(s => s.period_index === p);
      const s2 = tSlots.find(s => s.period_index === p + 1);
      if (s1 && s2 && s1.subject_id === s2.subject_id) {
        doubles.push({ subject: subjects[s1.subject_id], class: classes[s1.class_id], p1: p, p2: p + 1 });
      }
    }
    if (doubles.length >= 2) {
      console.log(`  Teacher ${tName} on ${d} has ${doubles.length} doubles:`);
      for (const db of doubles) {
        console.log(`    - ${db.class} ${db.subject} P${db.p1}-P${db.p2}`);
      }
      for (let i = 0; i < doubles.length - 1; i++) {
        if (doubles[i].p2 + 1 === doubles[i+1].p1) {
          console.log(`    >>> BACK-TO-BACK NO BREAK: ${tName} on ${d} P${doubles[i].p1}-P${doubles[i].p2} then P${doubles[i+1].p1}-P${doubles[i+1].p2}!`);
        }
      }
    }
  }
}

console.log('\n=== CHECK TEACHER CONSECUTIVE DIFFERENT SUBJECTS IN SAME CLASS ===');
for (const cId of Object.keys(classes)) {
  const cName = classes[cId];
  for (const d of days) {
    const cSlots = slots.filter(s => s.class_id === Number(cId) && s.day === d).sort((a,b) => a.period_index - b.period_index);
    for (let i = 0; i < cSlots.length - 1; i++) {
      const s1 = cSlots[i];
      const s2 = cSlots[i+1];
      if (s2.period_index === s1.period_index + 1 && s1.teacher_id === s2.teacher_id && s1.subject_id !== s2.subject_id) {
        console.log(`  Class ${cName} on ${d}: Teacher ${teachers[s1.teacher_id]} teaches ${subjects[s1.subject_id]} at P${s1.period_index} THEN ${subjects[s2.subject_id]} at P${s2.period_index}!`);
      }
    }
  }
}
