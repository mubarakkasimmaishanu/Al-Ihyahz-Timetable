import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

const rows = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

function teacherFatigueScore(slots) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const teachers = [...new Set(slots.map(s => s.teacher_name))];
  let sumayyaMaxRun = 0;
  let sumayyaThuAft = 0;
  let total4PlusRuns = 0;
  let details = [];

  for (const t of teachers) {
    for (const d of days) {
      const dSlots = slots.filter(s => s.teacher_name === t && s.day === d);
      const pSet = new Set(dSlots.map(s => s.period_index));

      // Check within morning (P1-P4) and within afternoon (P5-P8)
      let mRun = 0;
      for (let p = 1; p <= 4; p++) {
        if (pSet.has(p)) {
          mRun++;
          if (mRun >= 4) {
            total4PlusRuns++;
            if (t.includes('Sumayya')) details.push(`Sumayya ${d} morning 4-run`);
          }
        } else {
          mRun = 0;
        }
      }

      let aRun = 0;
      for (let p = 5; p <= 8; p++) {
        if (pSet.has(p)) {
          aRun++;
          if (aRun >= 4) {
            total4PlusRuns++;
            if (t.includes('Sumayya')) {
              details.push(`Sumayya ${d} afternoon 4-run`);
              if (d === 'Thursday') sumayyaThuAft = aRun;
            }
          }
        } else {
          aRun = 0;
        }
      }

      // Continuous run without ANY break across whole day:
      // Note: between P4 and P5 is breakfast break, so a run from P3-P6 has a 30-min break between P4 and P5.
      // But P5-P8 has NO break at all!
    }
  }

  return { sumayyaThuAft, total4PlusRuns, details };
}

console.log('Baseline fatigue:', teacherFatigueScore(rows));

// Let's test all possible valid intra-class swaps (or 2-step swaps) across the entire timetable!
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];
let candidates = [];

for (const c of classes) {
  const cSlots = rows.filter(r => r.class_name === c);
  for (let i = 0; i < cSlots.length; i++) {
    for (let j = i + 1; j < cSlots.length; j++) {
      const s1 = cSlots[i];
      const s2 = cSlots[j];

      if (s1.day === s2.day && s1.period_index === s2.period_index) continue;
      const isPaired = (s) => ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(s.subject_name);
      if (isPaired(s1) || isPaired(s2)) continue;

      // Check teacher clashes
      const clash1 = rows.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s1.teacher_id && r.day === s2.day && r.period_index === s2.period_index);
      const clash2 = rows.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s2.teacher_id && r.day === s1.day && r.period_index === s1.period_index);
      if (clash1 || clash2) continue;

      // Preserve P8 teacher counts exactly
      if (s1.period_index === 8 || s2.period_index === 8) {
        if (s1.period_index !== s2.period_index) {
          if (s1.teacher_id !== s2.teacher_id) continue;
        }
      }

      // No English in P8
      if ((s1.subject_name.includes('ENG') && s2.period_index === 8) || (s2.subject_name.includes('ENG') && s1.period_index === 8)) continue;

      // Friday limits
      if (s1.day === 'Friday' && s2.day !== 'Friday') {
        if (c.startsWith('JS') && s2.period_index > 4) continue;
        if (c.startsWith('SS') && s2.period_index > 6) continue;
      }
      if (s2.day === 'Friday' && s1.day !== 'Friday') {
        if (c.startsWith('JS') && s1.period_index > 4) continue;
        if (c.startsWith('SS') && s1.period_index > 6) continue;
      }

      // Shehu must remain 100% free on Friday
      if (s1.teacher_name.includes('Shehu') && s2.day === 'Friday') continue;
      if (s2.teacher_name.includes('Shehu') && s1.day === 'Friday') continue;

      // Zainab Kabir must remain 100% free on Friday
      if (s1.teacher_name.includes('Kabir') && s2.day === 'Friday') continue;
      if (s2.teacher_name.includes('Kabir') && s1.day === 'Friday') continue;

      const simulated = rows.map(r => {
        if (r.id === s1.id) return { ...r, day: s2.day, period_index: s2.period_index };
        if (r.id === s2.id) return { ...r, day: s1.day, period_index: s1.period_index };
        return r;
      });

      const score = teacherFatigueScore(simulated);
      if (score.sumayyaThuAft === 0) {
        // Also check if any adjacent different subject violations were created in Junior
        let adjViolations = 0;
        const juniorClasses = ['JS 1', 'JS 2', 'JS 3'];
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        for (const jc of juniorClasses) {
          for (const d of days) {
            const jSlots = simulated.filter(s => s.class_name === jc && s.day === d).sort((a, b) => a.period_index - b.period_index);
            for (let k = 0; k < jSlots.length - 1; k++) {
              const a = jSlots[k];
              const b = jSlots[k + 1];
              if (a.period_index + 1 === b.period_index && a.teacher_id === b.teacher_id && a.subject_id !== b.subject_id) {
                adjViolations++;
              }
            }
          }
        }

        if (adjViolations === 0) {
          candidates.push({
            c, s1, s2, score
          });
        }
      }
    }
  }
}

console.log(`Found ${candidates.length} candidate swaps that completely eliminate Sumayya's Thursday afternoon 4-run with 0 junior adjacent violations!`);
for (const cand of candidates.slice(0, 10)) {
  console.log(`\nIn ${cand.c}:`);
  console.log(`  [${cand.s1.day} P${cand.s1.period_index}] ${cand.s1.subject_name} (${cand.s1.teacher_name}) <--> [${cand.s2.day} P${cand.s2.period_index}] ${cand.s2.subject_name} (${cand.s2.teacher_name})`);
  console.log(`  Score: total 4-runs = ${cand.score.total4PlusRuns}`);
}
