import { db } from './db/database.js';
import fs from 'fs';

const slots = JSON.parse(fs.readFileSync('./server/data/solved_246_slots.json', 'utf8'));
const teachers = Object.fromEntries(db.prepare('SELECT id, name FROM teachers').all().map(t => [t.id, t.name]));
const subjects = Object.fromEntries(db.prepare('SELECT id, code, name FROM subjects').all().map(s => [s.id, s.code]));
const classes = Object.fromEntries(db.prepare('SELECT id, name FROM classes').all().map(c => [c.id, c.name]));

// Check Swap 1: JS 3 Thursday P6 (BUS, Zainab) <-> P7 (HAUSA, Nabila)
const sZainabThu7 = slots.find(s => teachers[s.teacher_id] === 'M. Zainab Kabir' && s.day === 'Thursday' && s.period_index === 7);
const sNabilaThu6 = slots.find(s => teachers[s.teacher_id] === 'M. Nabila' && s.day === 'Thursday' && s.period_index === 6);
console.log('Swap 1 (JS 3 Thu P6 <-> P7):');
console.log('  Is Zainab busy at Thu P7?', sZainabThu7 ? classes[sZainabThu7.class_id] + ' ' + subjects[sZainabThu7.subject_id] : 'FREE!');
console.log('  Is Nabila busy at Thu P6?', sNabilaThu6 ? classes[sNabilaThu6.class_id] + ' ' + subjects[sNabilaThu6.subject_id] : 'FREE!');

// Check Swap 2: SS 2 Wednesday P3 (AGR, Amina) <-> P6 (CIV, Abba)
const sAminaWed6 = slots.find(s => teachers[s.teacher_id] === 'M. Amina' && s.day === 'Wednesday' && s.period_index === 6);
const sAbbaWed3 = slots.find(s => teachers[s.teacher_id] === 'M. Abba' && s.day === 'Wednesday' && s.period_index === 3);
console.log('\nSwap 2 (SS 2 Wed P3 <-> P6):');
console.log('  Is Amina busy at Wed P6?', sAminaWed6 ? classes[sAminaWed6.class_id] + ' ' + subjects[sAminaWed6.subject_id] : 'FREE!');
console.log('  Is Abba busy at Wed P3?', sAbbaWed3 ? classes[sAbbaWed3.class_id] + ' ' + subjects[sAbbaWed3.subject_id] : 'FREE!');

// Check Swap 3: JS 1 Tuesday P7 (CMP, Sumayya) <-> P8 (BUS, Zainab)
const sSumayyaTue8 = slots.find(s => teachers[s.teacher_id] === 'M. Sumayya' && s.day === 'Tuesday' && s.period_index === 8);
const sZainabTue7 = slots.find(s => teachers[s.teacher_id] === 'M. Zainab Kabir' && s.day === 'Tuesday' && s.period_index === 7);
console.log('\nSwap 3 (JS 1 Tue P7 <-> P8):');
console.log('  Is Sumayya busy at Tue P8?', sSumayyaTue8 ? classes[sSumayyaTue8.class_id] + ' ' + subjects[sSumayyaTue8.subject_id] : 'FREE!');
console.log('  Is Zainab busy at Tue P7?', sZainabTue7 ? classes[sZainabTue7.class_id] + ' ' + subjects[sZainabTue7.subject_id] : 'FREE!');
