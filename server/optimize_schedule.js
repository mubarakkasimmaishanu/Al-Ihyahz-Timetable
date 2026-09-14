import { db } from './db/database.js';
import fs from 'fs';
import path from 'path';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

// Target Period 8 count per teacher
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

function evaluateSchedule(slots) {
  let penalty = 0;
  const issues = [];

  // 1. Teacher clashes (same teacher, same day, same period, different classes)
  const teacherTimeMap = {};
  for (const s of slots) {
    const key = `${s.teacher_id}_${s.day}_${s.period_index}`;
    if (teacherTimeMap[key]) {
      penalty += 100000;
      issues.push(`Teacher ${teacherMap[s.teacher_id]?.name} double booked at ${s.day} P${s.period_index}`);
    }
    teacherTimeMap[key] = s;
  }

  // 2. Class clashes (same class, same day, same period, except paired simultaneous electives)
  const classTimeMap = {};
  for (const s of slots) {
    const key = `${s.class_id}_${s.day}_${s.period_index}`;
    if (!classTimeMap[key]) classTimeMap[key] = [];
    classTimeMap[key].push(s);
  }
  for (const [key, group] of Object.entries(classTimeMap)) {
    if (group.length > 1) {
      // Check if legal paired elective (e.g. GOV/PHY, CHM/ECO, BIO/LIT in SS)
      if (group.length === 2) {
        const c1 = subjectMap[group[0].subject_id]?.code;
        const c2 = subjectMap[group[1].subject_id]?.code;
        const pair = [c1, c2].sort().join('/');
        if (pair !== 'GOV/PHY' && pair !== 'CHM/ECO' && pair !== 'BIO/LIT') {
          penalty += 100000;
          issues.push(`Illegal simultaneous subjects in class: ${pair} at ${key}`);
        }
      } else {
        penalty += 100000;
        issues.push(`Overbooked class at ${key}`);
      }
    }
  }

  // 3. Assembly & Friday dismissal rules
  for (const s of slots) {
    if ((s.day === 'Monday' || s.day === 'Friday') && s.period_index === 1) {
      penalty += 100000;
      issues.push(`Class in assembly period at ${s.day} P1`);
    }
    const cls = classMap[s.class_id];
    const isJun = cls?.name?.startsWith('JS') || cls?.level === 'JS';
    if (s.day === 'Friday') {
      if (isJun && s.period_index > 4) {
        penalty += 100000;
        issues.push(`Junior class after P4 on Friday: ${cls.name} P${s.period_index}`);
      }
      if (!isJun && s.period_index > 6) {
        penalty += 100000;
        issues.push(`Senior class after P6 on Friday: ${cls.name} P${s.period_index}`);
      }
    }
  }

  // 4. M. Shehu time preference (Morning only, max P6, 100% free Friday)
  for (const s of slots) {
    const t = teacherMap[s.teacher_id];
    if (t?.name?.includes('Shehu')) {
      if (s.day === 'Friday') {
        penalty += 100000;
        issues.push(`M. Shehu scheduled on Friday`);
      }
      if (s.period_index > 6) {
        penalty += 100000;
        issues.push(`M. Shehu scheduled after P6: P${s.period_index}`);
      }
    }
    if (t?.name?.includes('Zainab') && s.day === 'Friday') {
      penalty += 100000;
      issues.push(`M. Zainab Kabir scheduled on Friday`);
    }
  }

  // 5. Subject Placement Rules:
  // - Math never P7, P8 on Mon-Thu, never P5, P6 on Friday
  // - English never P8 on Mon-Thu, never P5, P6 on Friday
  // - Chemistry never P8
  for (const s of slots) {
    const code = subjectMap[s.subject_id]?.code;
    if (code === 'MTH') {
      if (s.day !== 'Friday' && s.period_index >= 7) {
        penalty += 50000;
        issues.push(`Math in tired hours: ${s.day} P${s.period_index}`);
      }
      if (s.day === 'Friday' && s.period_index >= 5) {
        penalty += 50000;
        issues.push(`Math on Friday tired hours: P${s.period_index}`);
      }
    }
    if (code === 'ENG') {
      if (s.day !== 'Friday' && s.period_index >= 8) {
        penalty += 50000;
        issues.push(`English in P8: ${s.day} P${s.period_index}`);
      }
      if (s.day === 'Friday' && s.period_index >= 5) {
        penalty += 50000;
        issues.push(`English on Friday tired hours: P${s.period_index}`);
      }
    }
    if (code === 'CHM' && s.period_index === 8) {
      penalty += 50000;
      issues.push(`Chemistry in P8`);
    }
  }

  // 6. No duplicate subject on same day in class (unless planned double period)
  for (const c of classes) {
    for (const d of days) {
      const cSlots = slots.filter(s => s.class_id === c.id && s.day === d);
      const subOccur = {};
      for (const s of cSlots) {
        if (!subOccur[s.subject_id]) subOccur[s.subject_id] = [];
        subOccur[s.subject_id].push(s.period_index);
      }
      for (const [subId, periods] of Object.entries(subOccur)) {
        if (periods.length > 2) {
          penalty += 50000;
          issues.push(`Subject ${subjectMap[subId]?.code} appears ${periods.length} times in ${c.name} on ${d}`);
        } else if (periods.length === 2) {
          if (Math.abs(periods[0] - periods[1]) !== 1) {
            penalty += 50000;
            issues.push(`Subject ${subjectMap[subId]?.code} split across non-adjacent periods in ${c.name} on ${d}: P${periods[0]} and P${periods[1]}`);
          } else if (Math.min(...periods) === 4) {
            penalty += 50000;
            issues.push(`Double period across break: ${c.name} on ${d} P4-P5`);
          }
        }
      }
    }
  }

  // 7. USER COMPLAINT 1: Period 8 Equality
  const p8Count = {};
  for (const s of slots.filter(x => x.period_index === 8)) {
    const tName = teacherMap[s.teacher_id]?.name;
    p8Count[tName] = (p8Count[tName] || 0) + 1;
  }
  for (const [tName, target] of Object.entries(TARGET_P8)) {
    const actual = p8Count[tName] || 0;
    if (actual !== target) {
      const diff = Math.abs(actual - target);
      penalty += diff * 15000;
      issues.push(`Period 8 inequality: ${tName} has ${actual} slots (target: ${target})`);
    }
  }

  // 8. USER COMPLAINT 2: No teacher teaching two double periods without break
  for (const t of teachers) {
    for (const d of days) {
      const tSlots = slots.filter(s => s.teacher_id === t.id && s.day === d);
      // Morning doubles (P1-P4)
      let mDoubles = 0;
      for (let p = 1; p <= 3; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id) mDoubles++;
      }
      if (mDoubles > 1) {
        penalty += mDoubles * 10000;
        issues.push(`Teacher ${t.name} on ${d} has ${mDoubles} morning doubles`);
      }

      // Afternoon doubles (P5-P8)
      let aDoubles = 0;
      for (let p = 5; p <= 7; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id) aDoubles++;
      }
      if (aDoubles > 1) {
        penalty += aDoubles * 10000;
        issues.push(`Teacher ${t.name} on ${d} has ${aDoubles} afternoon doubles`);
      }

      // Back-to-back across session break (P3-P4 double followed immediately by P5-P6 double)
      const s3 = tSlots.find(s => s.period_index === 3);
      const s4 = tSlots.find(s => s.period_index === 4);
      const s5 = tSlots.find(s => s.period_index === 5);
      const s6 = tSlots.find(s => s.period_index === 6);
      if (s3 && s4 && s3.subject_id === s4.subject_id && s5 && s6 && s5.subject_id === s6.subject_id) {
        penalty += 15000;
        issues.push(`Teacher ${t.name} on ${d} has back-to-back doubles P3-P4 and P5-P6`);
      }
    }
  }

  // 9. USER COMPLAINT 3: No teacher finishing a class then entering again with another subject
  for (const c of classes) {
    for (const d of days) {
      const cSlots = slots.filter(s => s.class_id === c.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
      for (let i = 0; i < cSlots.length - 1; i++) {
        const s1 = cSlots[i];
        const s2 = cSlots[i+1];
        if (s2.period_index === s1.period_index + 1 && s1.teacher_id === s2.teacher_id && s1.subject_id !== s2.subject_id) {
          penalty += 20000;
          issues.push(`Adjacent different subjects in ${c.name} on ${d}: Teacher ${teacherMap[s1.teacher_id]?.name} (${subjectMap[s1.subject_id]?.code} P${s1.period_index} -> ${subjectMap[s2.subject_id]?.code} P${s2.period_index})`);
        }
      }
    }
  }

  return { penalty, issues };
}

// Load current 246 slots
const initialSlots = JSON.parse(fs.readFileSync('./server/data/solved_246_slots.json', 'utf8'));
const initEval = evaluateSchedule(initialSlots);
console.log('Initial Schedule Penalty:', initEval.penalty);
console.log('Initial Issues Count:', initEval.issues.length);
initEval.issues.forEach(iss => console.log('  *', iss));

// Optimization using Simulated Annealing / Local Search
console.log('\nStarting targeted local optimization...');
let currentSlots = JSON.parse(JSON.stringify(initialSlots));
let bestSlots = JSON.parse(JSON.stringify(initialSlots));
let bestPenalty = initEval.penalty;

let temp = 100.0;
const coolingRate = 0.9995;
let iteration = 0;
const maxIterations = 50000;

while (iteration < maxIterations && bestPenalty > 0) {
  iteration++;

  // Pick a random class and two slots to swap within that class
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const classSlots = currentSlots.filter(s => s.class_id === randomClass.id);

  const idxA = Math.floor(Math.random() * classSlots.length);
  let idxB = Math.floor(Math.random() * classSlots.length);
  if (idxA === idxB) continue;

  const sA = classSlots[idxA];
  const sB = classSlots[idxB];

  // Do not swap locked slots
  if (sA.is_locked || sB.is_locked) continue;
  // If same day and period, skip
  if (sA.day === sB.day && sA.period_index === sB.period_index) continue;

  // Perform swap trial
  const origDayA = sA.day, origPeriodA = sA.period_index;
  const origDayB = sB.day, origPeriodB = sB.period_index;

  // Check if sA or sB are part of a paired elective:
  // If sA is paired, find its partner in currentSlots
  const partnerA = currentSlots.find(s => s !== sA && s.class_id === sA.class_id && s.day === origDayA && s.period_index === origPeriodA);
  const partnerB = currentSlots.find(s => s !== sB && s.class_id === sB.class_id && s.day === origDayB && s.period_index === origPeriodB);

  // If both or neither are paired, or if single:
  if (partnerA && !partnerB) continue;
  if (!partnerA && partnerB) continue;

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

  const trialEval = evaluateSchedule(currentSlots);

  const delta = trialEval.penalty - bestPenalty;
  if (trialEval.penalty < bestPenalty) {
    bestPenalty = trialEval.penalty;
    bestSlots = JSON.parse(JSON.stringify(currentSlots));
    console.log(`[Iter ${iteration}] New BEST Penalty: ${bestPenalty} (Issues: ${trialEval.issues.length})`);
    if (bestPenalty === 0) {
      console.log('🎉 PERFECT COMPLIANT SCHEDULE ACHIEVED (Penalty = 0)!');
      break;
    }
  } else if (Math.random() < Math.exp(-delta / temp)) {
    // Accept worsening move
  } else {
    // Revert move
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

if (bestPenalty === 0) {
  console.log('\n================ SUCCESS: 100% COMPLIANT TIMETABLE GENERATED ================');
  const finalEval = evaluateSchedule(bestSlots);
  console.log('Final Penalty:', finalEval.penalty);
  console.log('Remaining Issues:', finalEval.issues.length);

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
} else {
  console.log(`Optimization reached iteration limit with best penalty ${bestPenalty}.`);
}
