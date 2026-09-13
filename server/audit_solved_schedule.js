import { db } from './db/database.js';
import { TimetableGenerator } from './engine/generator-balanced.js';
import { validateTimetable } from './engine/validator.js';
import { ejectionChainRepair } from './test_ejection_chain_v2.js';

const classes = db.prepare('SELECT * FROM classes').all();
const teachers = db.prepare('SELECT * FROM teachers').all();
const subjects = db.prepare('SELECT * FROM subjects').all();
const allocations = db.prepare('SELECT * FROM allocations').all();
const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

const gen = new TimetableGenerator({ regularPeriods: 8, fridayPeriods: 6 });

for (let r = 0; r < 40; r++) {
  const res = gen._attemptSolve(classes, teachers, subjects, allocations, [], r > 0);
  const rep = ejectionChainRepair(res.slots, res.unplacedUnits, gen);
  if (rep.unplacedCount === 0) {
    console.log(`\nFound solved solution on restart ${r}! Auditing...`);
    const slots = rep.slots;

    // 1. Period 8 Audit
    console.log('\n=== PERIOD 8 DISTRIBUTION ===');
    const p8Slots = slots.filter(s => s.period_index === 8);
    console.log('Total Period 8 slots:', p8Slots.length);
    console.table(p8Slots.map(s => ({
      class: classMap[s.class_id].name,
      day: s.day,
      subject: subjectMap[s.subject_id].name,
      code: subjectMap[s.subject_id].code,
      teacher: teacherMap[s.teacher_id].name
    })));

    // 2. Teacher Workload & Period 8 Counts
    console.log('\n=== TEACHER SUMMARY ===');
    for (const t of teachers) {
      const tSlots = slots.filter(s => s.teacher_id === t.id);
      const p8Count = tSlots.filter(s => s.period_index === 8).length;
      const morningCount = tSlots.filter(s => s.period_index <= 4).length;
      const afternoonCount = tSlots.filter(s => s.period_index >= 5).length;
      
      // Daily breakdown
      const daysStr = gen.days.map(d => {
        const cnt = tSlots.filter(s => s.day === d).length;
        return `${d.slice(0,3)}:${cnt}`;
      }).join(' ');

      // Check max consecutive
      let maxConsec = 0;
      for (const d of gen.days) {
        const dSlots = tSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
        let c = 0, lastP = -99;
        for (const s of dSlots) {
          if (s.period_index === lastP + 1) c++;
          else c = 1;
          lastP = s.period_index;
          if (c > maxConsec) maxConsec = c;
        }
      }

      console.log(`${t.name.padEnd(16)} | Total: ${tSlots.length.toString().padStart(2)} | P1-4: ${morningCount.toString().padStart(2)} | P5-8: ${afternoonCount.toString().padStart(2)} | P8: ${p8Count} | MaxRun: ${maxConsec} | ${daysStr}`);
    }

    // 3. Class Teachers Consecutive (check for double+double)
    console.log('\n=== SAME-CLASS CONSECUTIVE CHECK ===');
    let doubleDoubleFound = 0;
    for (const c of classes) {
      for (const d of gen.days) {
        const cSlots = slots.filter(s => s.class_id === c.id && s.day === d).sort((a,b) => a.period_index - b.period_index);
        // check if same teacher has > 2 consecutive periods
        for (let i = 0; i < cSlots.length - 2; i++) {
          if (cSlots[i].teacher_id === cSlots[i+1].teacher_id && cSlots[i+1].teacher_id === cSlots[i+2].teacher_id) {
            if (cSlots[i].period_index + 1 === cSlots[i+1].period_index && cSlots[i+1].period_index + 1 === cSlots[i+2].period_index) {
              console.log(`VIOLATION: 3+ consecutive periods with teacher ${teacherMap[cSlots[i].teacher_id].name} in ${c.name} on ${d} at P${cSlots[i].period_index}-${cSlots[i+2].period_index}`);
              doubleDoubleFound++;
            }
          }
        }
      }
    }
    if (doubleDoubleFound === 0) {
      console.log('SUCCESS: ZERO classes have > 2 consecutive periods with the same teacher!');
    }

    // 4. Paired Electives Check
    console.log('\n=== PAIRED ELECTIVES CHECK ===');
    const pairs = [['GOV','PHY'], ['CHM','ECO'], ['BIO','LIT']];
    let pairedSyncErrors = 0;
    for (const c of classes.filter(cls => cls.name.startsWith('SS'))) {
      for (const [cA, cB] of pairs) {
        const sA = subjects.find(s => s.code === cA);
        const sB = subjects.find(s => s.code === cB);
        const slotsA = slots.filter(s => s.class_id === c.id && s.subject_id === sA.id);
        const slotsB = slots.filter(s => s.class_id === c.id && s.subject_id === sB.id);
        if (slotsA.length !== 4 || slotsB.length !== 4) {
          console.log(`ERROR: ${c.name} ${cA}/${cB} count mismatch: ${slotsA.length} vs ${slotsB.length}`);
          pairedSyncErrors++;
        }
        for (const sa of slotsA) {
          const match = slotsB.find(sb => sb.day === sa.day && sb.period_index === sa.period_index);
          if (!match) {
            console.log(`ERROR: ${c.name} ${cA} at ${sa.day} P${sa.period_index} has no matching ${cB}`);
            pairedSyncErrors++;
          }
        }
      }
    }
    if (pairedSyncErrors === 0) {
      console.log('SUCCESS: All paired electives in SS 1-3 are 100% synchronized and have 4 contacts each!');
    }

    break;
  }
}
