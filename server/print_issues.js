import { db } from './db/database.js';
import fs from 'fs';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.code]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

const slots = JSON.parse(fs.readFileSync('./server/data/solved_246_slots.json', 'utf8'));

console.log('=== JS 1 Thursday ===');
const js1Thu = slots.filter(s => classMap[s.class_id] === 'JS 1' && s.day === 'Thursday').sort((a,b) => a.period_index - b.period_index);
console.log(js1Thu.map(s => `P${s.period_index}: ${subjectMap[s.subject_id]} (${teacherMap[s.teacher_id]})`));

console.log('\n=== JS 3 Thursday ===');
const js3Thu = slots.filter(s => classMap[s.class_id] === 'JS 3' && s.day === 'Thursday').sort((a,b) => a.period_index - b.period_index);
console.log(js3Thu.map(s => `P${s.period_index}: ${subjectMap[s.subject_id]} (${teacherMap[s.teacher_id]})`));

console.log('\n=== SS 2 Wednesday ===');
const ss2Wed = slots.filter(s => classMap[s.class_id] === 'SS 2' && s.day === 'Wednesday').sort((a,b) => a.period_index - b.period_index);
console.log(ss2Wed.map(s => `P${s.period_index}: ${subjectMap[s.subject_id]} (${teacherMap[s.teacher_id]})`));
