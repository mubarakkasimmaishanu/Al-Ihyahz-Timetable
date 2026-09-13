import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('Testing with current generator...');
const gen = new TimetableGenerator({ maxRestarts: 10 });
const res = gen.generate(classes, teachers, subjects, allocations);
console.log('Success:', res.success, 'Slots placed:', res.slots?.length);
