import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const nabila = teachers.find(t => t.name.includes('Nabila'));

// Let's test modifying generator.js in memory by creating a custom subclass
class BoostGenerator extends TimetableGenerator {
  constructor(options = {}, boost = 1000) {
    super(options);
    this.boost = boost;
  }

  // We can override _attemptSolve or test how different boosts perform
}

// Let's test with a direct script that overrides _attemptSolve's getPriority
const fileContent = (await import('fs')).readFileSync('./server/engine/generator.js', 'utf8');

// Let's test testing different priority adjustments directly
console.log('Testing priorities...');
