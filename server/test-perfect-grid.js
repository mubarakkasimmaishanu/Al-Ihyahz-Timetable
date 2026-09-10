import { TimetableGenerator } from './engine/generator.js';
import { db } from './db/database.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

console.log('Testing timetable solver...');
