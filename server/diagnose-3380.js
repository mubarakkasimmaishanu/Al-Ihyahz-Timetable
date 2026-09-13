import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  regularPeriods: 8,
  fridayPeriods: 6,
  maxRestarts: 1
});

const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], false);

// Find unit 3380_d1
const u = res.unplacedUnits.find(x => x.unitId === '3380_d1');
if (u) {
  console.log('Diagnosing unit 3380_d1 (SS 1 AGR, M. Amina, dur 2):');
  for (const d of gen.days) {
    const maxP = gen.getMaxPeriodsForDay(d);
    for (let p = 1; p <= maxP; p++) {
      const p2 = p + 1;
      const unitEnd = p + 1;
      const reasons = [];
      if (p >= maxP) continue;
      if ((d === 'Monday' || d === 'Friday') && (p === 1 || p2 === 1)) reasons.push('assembly');
      if (d !== 'Friday' && p === 4) reasons.push('break span');
      if (d === 'Friday') reasons.push('friday double');
      const cBusy = res.slots.some(s => s.class_id === u.class_id && s.day === d && (s.period_index === p || s.period_index === p2));
      if (cBusy) reasons.push('class busy');
      const tBusy = res.slots.some(s => s.teacher_id === u.alloc.teacher_id && s.day === d && (s.period_index === p || s.period_index === p2));
      if (tBusy) reasons.push('teacher busy');
      
      const tDaySlots = res.slots.filter(s => s.teacher_id === u.alloc.teacher_id && s.day === d);
      if (tDaySlots.length + 2 > 6) reasons.push('daily max > 6');

      const mCount = tDaySlots.filter(s => s.period_index <= 4).length;
      if (p <= 4 && mCount + 2 > 3) reasons.push(`morning count (${mCount} + 2 > 3)`);
      const aCount = tDaySlots.filter(s => s.period_index > 4).length;
      if (unitEnd > 4 && aCount + 2 > 3) reasons.push(`afternoon count (${aCount} + 2 > 3)`);

      const hasAdjacentInClass = res.slots.some(s => s.class_id === u.class_id && s.teacher_id === u.alloc.teacher_id && s.day === d && (s.period_index === p - 1 || s.period_index === unitEnd + 1));
      if (hasAdjacentInClass) reasons.push('adjacent in class');

      console.log(`  ${d} P${p}-P${p2}: ${reasons.join(', ') || 'OK'}`);
    }
  }
}
