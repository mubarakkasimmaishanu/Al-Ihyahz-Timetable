import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator.js';
import { validateTimetable } from './engine/validator.js';
import fs from 'fs';
import path from 'path';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

const gen = new TimetableGenerator({ maxRestarts: 1000 });

function isCandidatePerfect(candidateSlots) {
  if (!candidateSlots || candidateSlots.length !== 246) return false;

  // 1. Period 8 check: exactly 3 for each of the 8 eligible teachers, 0 for Shehu, Hassan, Nana
  const p8Count = {};
  for (const s of candidateSlots.filter(x => x.period_index === 8)) {
    p8Count[s.teacher_id] = (p8Count[s.teacher_id] || 0) + 1;
  }
  for (const t of teachers) {
    const isExcluded = t.name.includes('Shehu') || t.name.includes('Hassan') || t.name.includes('Nana');
    const cnt = p8Count[t.id] || 0;
    if (isExcluded && cnt > 0) return false;
    if (!isExcluded && cnt !== 3) return false;
  }

  // 2. Double-double check: max 1 double per session per teacher, no back-to-back doubles across break
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const t of teachers) {
    for (const d of days) {
      const tSlots = candidateSlots.filter(s => s.teacher_id === t.id && s.day === d);
      // Morning doubles (P1-P4)
      let mDoubles = 0;
      for (let p = 1; p <= 3; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id) mDoubles++;
      }
      if (mDoubles > 1) return false;

      // Afternoon doubles (P5-P8)
      let aDoubles = 0;
      for (let p = 5; p <= 7; p++) {
        const s1 = tSlots.find(s => s.period_index === p);
        const s2 = tSlots.find(s => s.period_index === p + 1);
        if (s1 && s2 && s1.subject_id === s2.subject_id) aDoubles++;
      }
      if (aDoubles > 1) return false;

      // Across break back-to-back: P3-P4 and P5-P6
      const s3 = tSlots.find(s => s.period_index === 3);
      const s4 = tSlots.find(s => s.period_index === 4);
      const s5 = tSlots.find(s => s.period_index === 5);
      const s6 = tSlots.find(s => s.period_index === 6);
      if (s3 && s4 && s3.subject_id === s4.subject_id && s5 && s6 && s5.subject_id === s6.subject_id) {
        return false;
      }
    }
  }

  // 3. Same class consecutive different subjects check
  for (const c of classes) {
    for (const d of days) {
      const cSlots = candidateSlots.filter(s => s.class_id === c.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
      for (let i = 0; i < cSlots.length - 1; i++) {
        const s1 = cSlots[i];
        const s2 = cSlots[i+1];
        if (s2.period_index === s1.period_index + 1 && s1.teacher_id === s2.teacher_id && s1.subject_id !== s2.subject_id) {
          return false;
        }
      }
    }
  }

  // 4. Basic validator check
  const val = validateTimetable(candidateSlots, classes, teachers, subjects, allocations, { fridayPeriods: 6 });
  if (!val.isValid || val.conflicts.length > 0) return false;

  return true;
}

function tryRepairWithSwap(slots, unplacedUnits) {
  if (unplacedUnits.length !== 1) return null;
  const unplacedUnit = unplacedUnits[0];
  const targetClassId = unplacedUnit.class_id;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const empties = [];
  for (const cls of classes) {
    const isJunior = cls.name?.startsWith('JS') || cls.level === 'JS';
    for (const d of days) {
      const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
      const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
      for (let p = startP; p <= maxP; p++) {
        if (!slots.some(s => s.class_id === cls.id && s.day === d && s.period_index === p)) {
          empties.push({ class_id: cls.id, day: d, period: p });
        }
      }
    }
  }

  const singleSlots = slots.filter(s => !s.is_locked);
  const slotsByClass = {};
  for (const s of singleSlots) {
    if (!slotsByClass[s.class_id]) slotsByClass[s.class_id] = [];
    slotsByClass[s.class_id].push(s);
  }

  for (const [clsIdStr, cSlots] of Object.entries(slotsByClass)) {
    const clsId = Number(clsIdStr);

    for (let i = 0; i < cSlots.length; i++) {
      for (let j = i + 1; j < cSlots.length; j++) {
        const sA = cSlots[i];
        const sB = cSlots[j];
        if (sA.day === sB.day && sA.period_index === sB.period_index) continue;
        if (sA.subject_id === sB.subject_id && sA.teacher_id === sB.teacher_id) continue;

        const withoutBoth = slots.filter(x => x !== sA && x !== sB);
        const unitA = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sA.subject_id, teacher_id: sA.teacher_id, class_id: clsId } };
        const unitB = { class_id: clsId, duration: 1, isPaired: false, alloc: { subject_id: sB.subject_id, teacher_id: sB.teacher_id, class_id: clsId } };

        if (gen._canPlaceSlot(unitA, sB.day, sB.period_index, withoutBoth, classMap, teacherMap, subjectMap)) {
          const withAAtB = [...withoutBoth, { ...sA, day: sB.day, period_index: sB.period_index }];
          if (gen._canPlaceSlot(unitB, sA.day, sA.period_index, withAAtB, classMap, teacherMap, subjectMap)) {
            const swappedSlots = [...withAAtB, { ...sB, day: sA.day, period_index: sA.period_index }];

            for (const e of empties) {
              if (e.class_id === targetClassId && gen._canPlaceSlot(unplacedUnit, e.day, e.period, swappedSlots, classMap, teacherMap, subjectMap)) {
                return [...swappedSlots, {
                  class_id: targetClassId,
                  subject_id: unplacedUnit.alloc.subject_id,
                  teacher_id: unplacedUnit.alloc.teacher_id,
                  day: e.day,
                  period_index: e.period,
                  is_locked: 0
                }];
              }
            }

            for (const e of empties) {
              if (e.class_id === targetClassId) {
                for (const sTarget of swappedSlots.filter(s => s.class_id === targetClassId)) {
                  const withoutSTarget = swappedSlots.filter(x => x !== sTarget);
                  const uTarget = { class_id: targetClassId, duration: 1, isPaired: false, alloc: { subject_id: sTarget.subject_id, teacher_id: sTarget.teacher_id, class_id: targetClassId } };
                  if (gen._canPlaceSlot(uTarget, e.day, e.period, withoutSTarget, classMap, teacherMap, subjectMap)) {
                    const withSTargetAtE = [...withoutSTarget, { ...sTarget, day: e.day, period_index: e.period }];
                    if (gen._canPlaceSlot(unplacedUnit, sTarget.day, sTarget.period_index, withSTargetAtE, classMap, teacherMap, subjectMap)) {
                      return [...withSTargetAtE, {
                        class_id: targetClassId,
                        subject_id: unplacedUnit.alloc.subject_id,
                        teacher_id: unplacedUnit.alloc.teacher_id,
                        day: sTarget.day,
                        period_index: sTarget.period_index,
                        is_locked: 0
                      }];
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

console.log('Searching for 100% complete, fully balanced, complaint-free 246-slot schedule...');
let solvedSlots = null;
let winningRestart = -1;

for (let r = 0; r < 1000; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = gen._repairSchedule(res.slots, res.unplacedUnits, classes, teachers, subjects);

  let candidate = null;
  if (rep.unplacedCount === 0) {
    candidate = rep.slots;
  } else if (rep.unplacedCount === 1) {
    candidate = tryRepairWithSwap(rep.slots, rep.unplaced);
  }

  if (candidate && isCandidatePerfect(candidate)) {
    solvedSlots = candidate;
    winningRestart = r;
    console.log(`🎉 100% Perfect and Verified Solution found at restart ${r}!`);
    break;
  } else if (r % 50 === 0 && r > 0) {
    console.log(`  Passed restart ${r}... continuing search.`);
  }
}

if (!solvedSlots) {
  console.log('Search exhausted without finding a 100% compliant schedule.');
  process.exit(1);
}

console.log(`\n================ WINNING SOLUTION FOUND AT RESTART ${winningRestart} ================`);
console.log(`Total slots: ${solvedSlots.length} / 246`);

// Check gaps
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
let totalGaps = 0;
for (const cls of classes) {
  const cSlots = solvedSlots.filter(s => s.class_id === cls.id);
  const isJunior = cls.name.startsWith('JS');
  for (const d of days) {
    const maxP = d === 'Friday' ? (isJunior ? 4 : 6) : 8;
    const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
    const daySlots = cSlots.filter(s => s.day === d).map(s => s.period_index);
    for (let p = startP; p <= maxP; p++) {
      if (!daySlots.includes(p)) {
        totalGaps++;
        console.log(`  GAP in ${cls.name} on ${d} P${p}!`);
      }
    }
  }
}
console.log(`Total internal/empty gaps across all classes: ${totalGaps}`);

// Save to JSON
const outDir = path.join(process.cwd(), 'server', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'solved_246_slots.json'), JSON.stringify(solvedSlots, null, 2));
console.log(`Saved 246 slots to server/data/solved_246_slots.json`);

// Save to SQLite database
const insertSlot = db.prepare(`
  INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
  VALUES (@class_id, @subject_id, @teacher_id, @day, @period_index, @is_locked)
`);

const deleteSlots = db.prepare(`DELETE FROM timetable_slots`);

db.exec('BEGIN');
try {
  deleteSlots.run();
  for (const s of solvedSlots) {
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
  console.log(`Successfully committed all ${solvedSlots.length} slots into SQLite timetable_slots!`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Database transaction failed:', err);
  process.exit(1);
}

// Print teacher summary
console.log('\n--- TEACHER P8 DISTRIBUTION ---');
for (const t of teachers) {
  const p8 = solvedSlots.filter(s => s.teacher_id === t.id && s.period_index === 8);
  console.log(`  ${t.name.padEnd(20)}: ${p8.length} slots (${p8.map(s => s.day.substring(0,3) + ' [' + classMap[s.class_id].name + ' ' + subjectMap[s.subject_id].code + ']').join(', ')})`);
}

console.log('\n--- FRIDAY WORKLOAD ---');
for (const t of teachers) {
  const fri = solvedSlots.filter(s => s.teacher_id === t.id && s.day === 'Friday');
  console.log(`  ${t.name.padEnd(20)}: ${fri.length} slots (${fri.map(s => 'P' + s.period_index + ' [' + classMap[s.class_id].name + ' ' + subjectMap[s.subject_id].code + ']').join(', ')})`);
}
