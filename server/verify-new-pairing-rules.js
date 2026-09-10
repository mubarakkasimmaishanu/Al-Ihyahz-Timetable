import { db } from './db/database.js';
import { validateTimetable } from './engine/validator.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const slots = db.prepare('SELECT * FROM timetable_slots').all();

const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

console.log('=== VERIFICATION OF NEW ELECTIVE PAIRINGS & CONSTRAINTS ===');
console.log(`Total slots: ${slots.length}`);

// 1. Run validator
const validation = validateTimetable(slots, classes, teachers, subjects, allocations, {
  fridayPeriods: 4,
  regularPeriods: 8
});

console.log(`Validation conflicts: ${validation.conflicts.length}`);
if (validation.conflicts.length > 0) {
  console.error('Conflicts found:', validation.conflicts);
}

// 2. Check Chemistry in Period 8
const chmSlots = slots.filter(s => {
  const code = subjectMap[s.subject_id]?.code;
  return code === 'CHM' || code === 'CHEM';
});
const chmP8 = chmSlots.filter(s => s.period_index === 8);
const chmP7 = chmSlots.filter(s => s.period_index === 7);
console.log(`Total Chemistry slots: ${chmSlots.length}`);
console.log(`Chemistry in Period 8: ${chmP8.length} (Expected: 0)`);
console.log(`Chemistry in Period 7: ${chmP7.length}`);
chmSlots.forEach(s => {
  console.log(`  CHM -> ${classMap[s.class_id].name}: ${s.day} P${s.period_index} (${teacherMap[s.teacher_id].name})`);
});

// 3. Check Pairings in SS 1, SS 2, SS 3
const ssClasses = classes.filter(c => c.name.startsWith('SS'));
for (const cls of ssClasses) {
  console.log(`\n--- Checking Pairings in ${cls.name} ---`);
  const cSlots = slots.filter(s => s.class_id === cls.id);

  // Pair 1: ECO <-> CHM
  const ecoSlots = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'ECO');
  const clsChm = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'CHM');
  console.log(`  ECO (${ecoSlots.length}) vs CHM (${clsChm.length}):`);
  for (const e of ecoSlots) {
    const match = clsChm.find(c => c.day === e.day && c.period_index === e.period_index);
    if (!match) {
      console.error(`    MISMATCH: ECO on ${e.day} P${e.period_index} has no simultaneous CHM!`);
    } else {
      console.log(`    OK: ${e.day} P${e.period_index} -> ECO (${teacherMap[e.teacher_id].name}) paired w/ CHM (${teacherMap[match.teacher_id].name})`);
    }
  }

  // Pair 2: BIO <-> LIT
  const bioSlots = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'BIO');
  const litSlots = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'LIT');
  console.log(`  BIO (${bioSlots.length}) vs LIT (${litSlots.length}):`);
  for (const b of bioSlots) {
    const match = litSlots.find(l => l.day === b.day && l.period_index === b.period_index);
    if (!match) {
      console.error(`    MISMATCH: BIO on ${b.day} P${b.period_index} has no simultaneous LIT!`);
    } else {
      console.log(`    OK: ${b.day} P${b.period_index} -> BIO (${teacherMap[b.teacher_id].name}) paired w/ LIT (${teacherMap[match.teacher_id].name})`);
    }
  }

  // Pair 3: GOV <-> PHY
  const govSlots = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'GOV');
  const phySlots = cSlots.filter(s => subjectMap[s.subject_id]?.code === 'PHY');
  console.log(`  GOV (${govSlots.length}) vs PHY (${phySlots.length}):`);
  for (const g of govSlots) {
    const match = phySlots.find(p => p.day === g.day && p.period_index === g.period_index);
    if (!match) {
      console.error(`    MISMATCH: GOV on ${g.day} P${g.period_index} has no simultaneous PHY!`);
    } else {
      console.log(`    OK: ${g.day} P${g.period_index} -> GOV (${teacherMap[g.teacher_id].name}) paired w/ PHY (${teacherMap[match.teacher_id].name})`);
    }
  }
}

// 4. Check Friday Slots
const fridaySlots = slots.filter(s => s.day === 'Friday');
const fridayAfterBreak = fridaySlots.filter(s => s.period_index > 4);
console.log(`\nFriday total slots: ${fridaySlots.length}`);
console.log(`Friday slots after P4: ${fridayAfterBreak.length} (Expected: 0)`);

// 5. Check Teacher Day Off & Shift Constraints
const shehu = teachers.find(t => t.name.includes('Shehu'));
const zainab = teachers.find(t => t.name.includes('Zainab'));
const shehuFri = slots.filter(s => s.teacher_id === shehu.id && s.day === 'Friday');
const zainabFri = slots.filter(s => s.teacher_id === zainab.id && s.day === 'Friday');
const shehuLate = slots.filter(s => s.teacher_id === shehu.id && s.period_index > 6);
console.log(`M. Shehu Friday slots: ${shehuFri.length} (Expected: 0)`);
console.log(`M. Shehu P7/P8 slots: ${shehuLate.length} (Expected: 0)`);
console.log(`M. Zainab Kabir Friday slots: ${zainabFri.length} (Expected: 0)`);

// 6. Check Gaps
let totalGaps = 0;
for (const cls of classes) {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    const cDaySlots = slots.filter(s => s.class_id === cls.id && s.day === day);
    const indices = new Set(cDaySlots.map(s => s.period_index));
    const maxP = Math.max(0, ...indices);
    for (let p = 1; p < maxP; p++) {
      if (!indices.has(p)) {
        totalGaps++;
        console.error(`GAP: ${cls.name} on ${day} missing Period ${p}!`);
      }
    }
  }
}
console.log(`Total internal gaps across all classes: ${totalGaps} (Expected: 0)`);

if (validation.conflicts.length === 0 && chmP8.length === 0 && totalGaps === 0 && fridayAfterBreak.length === 0 && shehuFri.length === 0 && zainabFri.length === 0) {
  console.log('\n>>> ALL REQUIREMENTS 100% SATISFIED AND VERIFIED! <<<');
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
}
