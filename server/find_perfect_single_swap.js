import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/db/timetable.sqlite');

let slots = db.prepare(`
  SELECT ts.id, ts.class_id, ts.subject_id, ts.teacher_id, ts.day, ts.period_index,
         t.name as teacher_name, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN teachers t ON ts.teacher_id = t.id
  JOIN classes c ON ts.class_id = c.id
  JOIN subjects s ON ts.subject_id = s.id
  ORDER BY ts.day, ts.period_index
`).all();

function evaluate(currentSlots) {
  const tMap = new Set();
  let clashes = 0;
  for (const s of currentSlots) {
    const key = `${s.teacher_id}-${s.day}-${s.period_index}`;
    if (tMap.has(key)) clashes++;
    tMap.add(key);
  }

  // P8 counts
  const p8 = {};
  for (const s of currentSlots) {
    if (s.period_index === 8) {
      p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
    }
  }

  // Sumayya Thursday Afternoon consecutive
  const sumThuAft = currentSlots.filter(s => s.teacher_name.includes('Sumayya') && s.day === 'Thursday' && s.period_index >= 5);
  const pSet = new Set(sumThuAft.map(s => s.period_index));
  let run = 0, maxRunThu = 0;
  for (let p = 5; p <= 8; p++) {
    if (pSet.has(p)) { run++; if (run > maxRunThu) maxRunThu = run; }
    else run = 0;
  }

  // Sumayya max consecutive across whole week (any day, any session)
  // Let's measure within session (morning P1-P4, afternoon P5-P8)
  let maxSessionConsec = 0;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const d of days) {
    const dSlots = currentSlots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    const dSet = new Set(dSlots.map(s => s.period_index));
    let mRun = 0, aRun = 0;
    for (let p = 1; p <= 4; p++) {
      if (dSet.has(p)) { mRun++; if (mRun > maxSessionConsec) maxSessionConsec = mRun; }
      else mRun = 0;
    }
    for (let p = 5; p <= 8; p++) {
      if (dSet.has(p)) { aRun++; if (aRun > maxSessionConsec) maxSessionConsec = aRun; }
      else aRun = 0;
    }
  }

  // Junior adjacent different subjects
  let jrAdjViolations = 0;
  const jrClasses = ['JS 1', 'JS 2', 'JS 3'];
  for (const jc of jrClasses) {
    for (const d of days) {
      const jSlots = currentSlots.filter(s => s.class_name === jc && s.day === d).sort((a, b) => a.period_index - b.period_index);
      for (let k = 0; k < jSlots.length - 1; k++) {
        const a = jSlots[k];
        const b = jSlots[k + 1];
        if (a.period_index + 1 === b.period_index && a.teacher_id === b.teacher_id && a.subject_id !== b.subject_id) {
          jrAdjViolations++;
        }
      }
    }
  }

  return { clashes, p8, maxRunThu, maxSessionConsec, jrAdjViolations };
}

console.log('Baseline:', evaluate(slots));

// We want to find swaps of size 2 or 3 that reduce maxRunThu to <= 2 without increasing maxSessionConsec above 3!
// Let's test all pairs of intra-class swaps (swap 1 in class X, swap 2 in class Y)
const allValidSingleSwaps = [];
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];

for (const c of classes) {
  const cSlots = slots.filter(r => r.class_name === c);
  for (let i = 0; i < cSlots.length; i++) {
    for (let j = i + 1; j < cSlots.length; j++) {
      const s1 = cSlots[i];
      const s2 = cSlots[j];

      if (s1.day === s2.day && s1.period_index === s2.period_index) continue;
      const isPaired = (s) => ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(s.subject_name);
      if (isPaired(s1) || isPaired(s2)) continue;

      // P8 teacher preservation: only allow if neither is P8, or both are P8
      if (s1.period_index === 8 && s2.period_index !== 8) continue;
      if (s2.period_index === 8 && s1.period_index !== 8) continue;

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

      // Check teacher clashes for s1.teacher at s2.(day, period) and s2.teacher at s1.(day, period)
      const clash1 = slots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s1.teacher_id && r.day === s2.day && r.period_index === s2.period_index);
      const clash2 = slots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s2.teacher_id && r.day === s1.day && r.period_index === s1.period_index);
      if (clash1 || clash2) continue;

      if (s1.teacher_name.includes('Shehu') && s2.day === 'Friday') continue;
      if (s2.teacher_name.includes('Shehu') && s1.day === 'Friday') continue;
      if (s1.teacher_name.includes('Kabir') && s2.day === 'Friday') continue;
      if (s2.teacher_name.includes('Kabir') && s1.day === 'Friday') continue;

      allValidSingleSwaps.push({ c, s1, s2 });
    }
  }
}

console.log('Total valid single swaps in system:', allValidSingleSwaps.length);

// Check if any single swap achieves our goal:
for (const sw of allValidSingleSwaps) {
  const sim = slots.map(r => {
    if (r.id === sw.s1.id) return { ...r, day: sw.s2.day, period_index: sw.s2.period_index };
    if (r.id === sw.s2.id) return { ...r, day: sw.s1.day, period_index: sw.s1.period_index };
    return r;
  });
  const ev = evaluate(sim);
  if (ev.clashes === 0 && ev.maxRunThu <= 2 && ev.maxSessionConsec <= 3 && ev.jrAdjViolations === 0) {
    console.log(`\nPERFECT SINGLE SWAP in ${sw.c}:`);
    console.log(`  [${sw.s1.day} P${sw.s1.period_index}] ${sw.s1.subject_name} (${sw.s1.teacher_name}) <--> [${sw.s2.day} P${sw.s2.period_index}] ${sw.s2.subject_name} (${sw.s2.teacher_name})`);
    console.log(`  Result: Thursday afternoon run = ${ev.maxRunThu}, Week max session run = ${ev.maxSessionConsec}`);
  }
}
