import { db } from './db/database.js';
import fs from 'fs';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const TARGET_P8 = {
  'M. Shehu': 0,
  'M. Hassan': 0,
  'M. Nana Firdaus': 0,
  'M. Mubarak': 3,
  'M. Yusuf': 3,
  'M. Zainab Kabir': 3,
  'M. Sumayya': 3,
  'M. Abba': 3,
  'M. Amina': 3,
  'M. Maryam': 3,
  'M. Nabila': 3
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function evaluate(slts) {
  let p8Score = 0;
  const p8Count = {};
  for (const s of slts.filter(x => x.period_index === 8)) {
    const tName = teacherMap[s.teacher_id]?.name;
    p8Count[tName] = (p8Count[tName] || 0) + 1;
  }
  for (const [tName, target] of Object.entries(TARGET_P8)) {
    p8Score += Math.abs((p8Count[tName] || 0) - target);
  }

  // Double-double violations
  let ddScore = 0;
  for (const t of teachers) {
    for (const d of days) {
      const tSlots = slts.filter(s => s.teacher_id === t.id && s.day === d);
      // Morning doubles (P1-P4)
      let mDoubles = 0;
      for (let p = 1; p <= 3; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id && s1.class_id === s2.class_id) mDoubles++;
      }
      if (mDoubles > 1) ddScore += (mDoubles - 1);

      // Afternoon doubles (P5-P8)
      let aDoubles = 0;
      for (let p = 5; p <= 7; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id && s1.class_id === s2.class_id) aDoubles++;
      }
      if (aDoubles > 1) ddScore += (aDoubles - 1);

      // Back-to-back across session break (P3-P4 double followed immediately by P5-P6 double)
      const s3 = tSlots.find(s => s.period_index === 3);
      const s4 = tSlots.find(s => s.period_index === 4);
      const s5 = tSlots.find(s => s.period_index === 5);
      const s6 = tSlots.find(s => s.period_index === 6);
      if (s3 && s4 && s3.subject_id === s4.subject_id && s3.class_id === s4.class_id &&
          s5 && s6 && s5.subject_id === s6.subject_id && s5.class_id === s6.class_id) {
        ddScore += 1;
      }
    }
  }

  // Adjacent different subjects in same class
  let adjScore = 0;
  for (const c of classes) {
    for (const d of days) {
      const cSlots = slts.filter(s => s.class_id === c.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
      for (let i = 0; i < cSlots.length - 1; i++) {
        const s1 = cSlots[i];
        const s2 = cSlots[i+1];
        if (s2.period_index === s1.period_index + 1 && s1.teacher_id === s2.teacher_id && s1.subject_id !== s2.subject_id) {
          adjScore += 1;
        }
      }
    }
  }

  // Check no duplicate subjects on same day in class (unless planned double)
  let dupScore = 0;
  for (const c of classes) {
    for (const d of days) {
      const cSlots = slts.filter(s => s.class_id === c.id && s.day === d);
      const subOccur = {};
      for (const s of cSlots) {
        if (!subOccur[s.subject_id]) subOccur[s.subject_id] = [];
        subOccur[s.subject_id].push(s.period_index);
      }
      for (const periods of Object.values(subOccur)) {
        if (periods.length > 2) dupScore += (periods.length - 1);
        else if (periods.length === 2) {
          if (Math.abs(periods[0] - periods[1]) !== 1 || Math.min(...periods) === 4) {
            dupScore += 1;
          }
        }
      }
    }
  }

  const total = p8Score * 10 + ddScore * 5 + adjScore * 8 + dupScore * 20;
  return { total, p8Score, ddScore, adjScore, dupScore };
}

// Find all valid swaps in a class
function getValidMoves(slts, classId) {
  const cSlots = slts.filter(s => s.class_id === classId && !s.is_locked);
  const moves = [];

  for (let i = 0; i < cSlots.length; i++) {
    for (let j = i + 1; j < cSlots.length; j++) {
      const sA = cSlots[i];
      const sB = cSlots[j];
      if (sA.day === sB.day && sA.period_index === sB.period_index) continue;

      const partnerA = slts.find(s => s !== sA && s.class_id === classId && s.day === sA.day && s.period_index === sA.period_index);
      const partnerB = slts.find(s => s !== sB && s.class_id === classId && s.day === sB.day && s.period_index === sB.period_index);
      if ((partnerA && !partnerB) || (!partnerA && partnerB)) continue;

      if ((sA.day === 'Monday' || sA.day === 'Friday') && sB.period_index === 1) continue;
      if ((sB.day === 'Monday' || sB.day === 'Friday') && sA.period_index === 1) continue;

      const isJun = classMap[classId].name.startsWith('JS');
      if (sA.day === 'Friday' && sB.period_index > (isJun ? 4 : 6)) continue;
      if (sB.day === 'Friday' && sA.period_index > (isJun ? 4 : 6)) continue;

      const tA = teacherMap[sA.teacher_id];
      const tB = teacherMap[sB.teacher_id];
      if (tA?.name?.includes('Shehu') && (sB.day === 'Friday' || sB.period_index > 6)) continue;
      if (tB?.name?.includes('Shehu') && (sA.day === 'Friday' || sA.period_index > 6)) continue;
      if (tA?.name?.includes('Zainab') && sB.day === 'Friday') continue;
      if (tB?.name?.includes('Zainab') && sA.day === 'Friday') continue;

      // Check partner teachers if paired
      if (partnerA && partnerB) {
        const ptA = teacherMap[partnerA.teacher_id];
        const ptB = teacherMap[partnerB.teacher_id];
        if (ptA?.name?.includes('Shehu') && (sB.day === 'Friday' || sB.period_index > 6)) continue;
        if (ptB?.name?.includes('Shehu') && (sA.day === 'Friday' || sA.period_index > 6)) continue;
        if (ptA?.name?.includes('Zainab') && sB.day === 'Friday') continue;
        if (ptB?.name?.includes('Zainab') && sA.day === 'Friday') continue;

        const ptABusy = slts.some(s => s !== partnerA && s !== partnerB && s.teacher_id === partnerA.teacher_id && s.day === sB.day && s.period_index === sB.period_index);
        const ptBBusy = slts.some(s => s !== partnerA && s !== partnerB && s.teacher_id === partnerB.teacher_id && s.day === sA.day && s.period_index === sA.period_index);
        if (ptABusy || ptBBusy) continue;
      }

      const tABusy = slts.some(s => s !== sA && s !== sB && s.teacher_id === sA.teacher_id && s.day === sB.day && s.period_index === sB.period_index);
      const tBBusy = slts.some(s => s !== sA && s !== sB && s.teacher_id === sB.teacher_id && s.day === sA.day && s.period_index === sA.period_index);
      if (tABusy || tBBusy) continue;

      const codeA = subjectMap[sA.subject_id]?.code;
      const codeB = subjectMap[sB.subject_id]?.code;
      if (codeA === 'MTH' && (sB.period_index >= 7 || (sB.day === 'Friday' && sB.period_index >= 5))) continue;
      if (codeB === 'MTH' && (sA.period_index >= 7 || (sA.day === 'Friday' && sA.period_index >= 5))) continue;
      if (codeA === 'ENG' && (sB.period_index >= 8 || (sB.day === 'Friday' && sB.period_index >= 5))) continue;
      if (codeB === 'ENG' && (sA.period_index >= 8 || (sA.day === 'Friday' && sA.period_index >= 5))) continue;
      if (codeA === 'CHM' && sB.period_index === 8) continue;
      if (codeB === 'CHM' && sA.period_index === 8) continue;

      moves.push({ sA, sB, partnerA, partnerB });
    }
  }
  return moves;
}

// Load initial slots
const initialSlots = JSON.parse(fs.readFileSync('./server/data/solved_246_slots.json', 'utf8'));
const initScore = evaluate(initialSlots);
console.log('Initial Score:', initScore);

let currentSlots = JSON.parse(JSON.stringify(initialSlots));
let bestSlots = JSON.parse(JSON.stringify(initialSlots));
let bestScore = initScore.total;

// Simulated Annealing / Stochastic Hill Climbing over valid moves
let temp = 50.0;
const coolingRate = 0.9998;
const maxSteps = 100000;

for (let step = 0; step < maxSteps && bestScore > 0; step++) {
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const moves = getValidMoves(currentSlots, randomClass.id);
  if (moves.length === 0) continue;

  const move = moves[Math.floor(Math.random() * moves.length)];
  const { sA, sB, partnerA, partnerB } = move;

  const origDayA = sA.day, origPeriodA = sA.period_index;
  const origDayB = sB.day, origPeriodB = sB.period_index;

  sA.day = origDayB;
  sA.period_index = origPeriodB;
  sB.day = origDayA;
  sB.period_index = origPeriodA;
  if (partnerA && partnerB) {
    partnerA.day = origDayB;
    partnerA.period_index = origPeriodB;
    partnerB.day = origDayA;
    partnerB.period_index = origPeriodA;
  }

  const curEval = evaluate(currentSlots);
  const delta = curEval.total - bestScore;

  if (curEval.total < bestScore) {
    bestScore = curEval.total;
    bestSlots = JSON.parse(JSON.stringify(currentSlots));
    console.log(`[Step ${step}] New BEST Score: ${bestScore}`, curEval);
    if (bestScore === 0) break;
  } else if (Math.random() < Math.exp(-delta / temp)) {
    // accept
  } else {
    // revert
    sA.day = origDayA;
    sA.period_index = origPeriodA;
    sB.day = origDayB;
    sB.period_index = origPeriodB;
    if (partnerA && partnerB) {
      partnerA.day = origDayA;
      partnerA.period_index = origPeriodA;
      partnerB.day = origDayB;
      partnerB.period_index = origPeriodB;
    }
  }

  temp *= coolingRate;
}

console.log('\nSearch Finished with Best Score:', bestScore);
const finalEval = evaluate(bestSlots);
console.log('Final Details:', finalEval);

if (bestScore === 0) {
  console.log('🎉 100% PERFECT TIMETABLE ACHIEVED!');

  // Save to JSON
  fs.writeFileSync('./server/data/solved_246_slots.json', JSON.stringify(bestSlots, null, 2));
  console.log('Saved to server/data/solved_246_slots.json');

  // Commit to SQLite
  const insertSlot = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
    VALUES (@class_id, @subject_id, @teacher_id, @day, @period_index, @is_locked)
  `);
  const deleteSlots = db.prepare(`DELETE FROM timetable_slots`);

  db.exec('BEGIN');
  try {
    deleteSlots.run();
    for (const s of bestSlots) {
      insertSlot.run({
        class_id: s.class_id,
        subject_id: s.subject_id,
        teacher_id: s.teacher_id,
        day: s.day,
        period_index: s.period_index,
        is_locked: s.is_locked || 0
      });
    }
    db.exec('COMMIT');
    console.log(`Successfully committed all ${bestSlots.length} slots into SQLite database!`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Commit failed:', err);
  }

  // Print P8 distribution
  console.log('\n--- FINAL TEACHER PERIOD 8 DISTRIBUTION ---');
  for (const t of teachers) {
    const p8 = bestSlots.filter(s => s.teacher_id === t.id && s.period_index === 8);
    console.log(`  ${t.name.padEnd(20)}: ${p8.length} slots (${p8.map(s => s.day.substring(0,3) + ' [' + classMap[s.class_id].name + ' ' + subjectMap[s.subject_id].code + ']').join(', ')})`);
  }
}
