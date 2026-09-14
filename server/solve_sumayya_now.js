import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

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

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function evalSum(currentSlots) {
  let clashes = 0;
  const tMap = new Set();
  for (const s of currentSlots) {
    const k = `${s.teacher_id}-${s.day}-${s.period_index}`;
    if (tMap.has(k)) clashes++;
    tMap.add(k);
  }

  const cMap = new Map();
  let classClashes = 0;
  const paired = [
    ['GOVT', 'PHY'], ['PHY', 'GOVT'],
    ['CHEM', 'ECON'], ['ECON', 'CHEM'],
    ['BIO', 'LIT'], ['LIT', 'BIO']
  ];
  for (const s of currentSlots) {
    const k = `${s.class_id}-${s.day}-${s.period_index}`;
    if (cMap.has(k)) {
      const prev = cMap.get(k);
      const isP = paired.some(p => p[0] === prev && p[1] === s.subject_name);
      if (!isP) classClashes++;
    } else {
      cMap.set(k, s.subject_name);
    }
  }

  // Count 3-consec runs for Sumayya
  let runs = [];
  for (const d of days) {
    const dSlots = currentSlots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    const pSet = new Set(dSlots.map(s => s.period_index));
    for (let p = 1; p <= 6; p++) {
      if (pSet.has(p) && pSet.has(p + 1) && pSet.has(p + 2)) {
        runs.push(`${d} P${p}-P${p+2}`);
      }
    }
  }

  // P8 counts
  const p8 = {};
  for (const s of currentSlots) {
    if (s.period_index === 8) p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
  }
  let p8Wrong = 0;
  for (const t of ['M. Mubarak', 'M. Yusuf', 'M. Zainab Kabir', 'M. Sumayya', 'M. Abba', 'M. Amina', 'M. Maryam', 'M. Nabila']) {
    if (p8[t] !== 3) p8Wrong++;
  }
  for (const t of ['M. Shehu', 'M. Hassan', 'M. Nana Firdaus']) {
    if ((p8[t] || 0) > 0) p8Wrong += p8[t];
  }

  let engP8 = currentSlots.filter(s => s.period_index === 8 && s.subject_name.includes('ENG')).length;

  return { clashes, classClashes, p8Wrong, engP8, runsCount: runs.length, runs };
}

console.log('Baseline eval:', evalSum(slots));

// We want to eliminate runs.
// Relevant slots to swap are Sumayya's slots or slots in classes with runs.
const sumayyaSlots = slots.filter(s => s.teacher_name.includes('Sumayya'));
console.log('Sumayya has', sumayyaSlots.length, 'slots.');

// Candidate swaps: for each slot of Sumayya, check if it can swap with another slot in the same class
let solutions = [];

for (const s1 of sumayyaSlots) {
  const cSlots = slots.filter(s => s.class_id === s1.class_id && s.id !== s1.id);
  for (const s2 of cSlots) {
    // Basic checks
    if (s1.day === s2.day && s1.period_index === s2.period_index) continue;
    if (s1.period_index === 8 && s2.period_index !== 8) continue;
    if (s2.period_index === 8 && s1.period_index !== 8) continue;
    if ((s1.subject_name.includes('ENG') && s2.period_index === 8) || (s2.subject_name.includes('ENG') && s1.period_index === 8)) continue;
    if (s1.day === 'Friday' && s2.day !== 'Friday' && (s1.class_name.startsWith('JS') ? s2.period_index > 4 : s2.period_index > 6)) continue;
    if (s2.day === 'Friday' && s1.day !== 'Friday' && (s2.class_name.startsWith('JS') ? s1.period_index > 4 : s1.period_index > 6)) continue;
    if ((s2.teacher_name.includes('Shehu') || s2.teacher_name.includes('Kabir')) && s1.day === 'Friday') continue;

    // Check teacher clash for s1.teacher at s2.(day, period) and s2.teacher at s1.(day, period)
    const clash1 = slots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s1.teacher_id && r.day === s2.day && r.period_index === s2.period_index);
    const clash2 = slots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s2.teacher_id && r.day === s1.day && r.period_index === s1.period_index);
    if (clash1 || clash2) continue;

    // Simulate swap
    const sim = slots.map(r => {
      if (r.id === s1.id) return { ...r, day: s2.day, period_index: s2.period_index };
      if (r.id === s2.id) return { ...r, day: s1.day, period_index: s1.period_index };
      return r;
    });

    const ev = evalSum(sim);
    if (ev.clashes === 0 && ev.classClashes === 0 && ev.p8Wrong === 0 && ev.engP8 === 0) {
      if (ev.runsCount < evalSum(slots).runsCount) {
        solutions.push({ s1, s2, ev, sim });
      }
    }
  }
}

console.log(`Found ${solutions.length} direct single swaps that reduce Sumayya 3-consec runs!`);
for (const sol of solutions.slice(0, 10)) {
  console.log(`Swap: [${sol.s1.class_name}] ${sol.s1.day} P${sol.s1.period_index} ${sol.s1.subject_name} <--> ${sol.s2.day} P${sol.s2.period_index} ${sol.s2.subject_name} (${sol.s2.teacher_name})`);
  console.log(`  Runs remaining (${sol.ev.runsCount}): ${sol.ev.runs.join(', ')}`);
}
