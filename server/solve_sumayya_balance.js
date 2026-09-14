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

function evaluate(currentSlots) {
  // 1. Teacher clashes
  const tMap = new Set();
  let clashes = 0;
  for (const s of currentSlots) {
    const key = `${s.teacher_id}-${s.day}-${s.period_index}`;
    if (tMap.has(key)) clashes++;
    tMap.add(key);
  }

  // 2. Class clashes
  const cMap = new Map();
  let classClashes = 0;
  const paired = [
    ['GOVT', 'PHY'], ['PHY', 'GOVT'],
    ['CHEM', 'ECON'], ['ECON', 'CHEM'],
    ['BIO', 'LIT'], ['LIT', 'BIO']
  ];
  for (const s of currentSlots) {
    const key = `${s.class_id}-${s.day}-${s.period_index}`;
    if (cMap.has(key)) {
      const prev = cMap.get(key);
      const isP = paired.some(p => p[0] === prev && p[1] === s.subject_name);
      if (!isP) classClashes++;
    } else {
      cMap.set(key, s.subject_name);
    }
  }

  // 3. P8 counts
  const p8 = {};
  for (const s of currentSlots) {
    if (s.period_index === 8) p8[s.teacher_name] = (p8[s.teacher_name] || 0) + 1;
  }
  let p8Score = 0;
  const expectedP8 = ['M. Mubarak', 'M. Yusuf', 'M. Zainab Kabir', 'M. Sumayya', 'M. Abba', 'M. Amina', 'M. Maryam', 'M. Nabila'];
  for (const t of expectedP8) {
    if (p8[t] !== 3) p8Score += Math.abs((p8[t] || 0) - 3);
  }
  for (const t of ['M. Shehu', 'M. Hassan', 'M. Nana Firdaus']) {
    if ((p8[t] || 0) > 0) p8Score += p8[t] * 10;
  }

  // 4. Sumayya consecutive runs
  let sumayyaConsecScore = 0;
  let sumayyaDaily = {};
  for (const d of days) {
    const dSlots = currentSlots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    sumayyaDaily[d] = dSlots.length;
    const pSet = new Set(dSlots.map(s => s.period_index));
    // Score any consecutive run of 3 or more:
    for (let p = 1; p <= 6; p++) {
      if (pSet.has(p) && pSet.has(p + 1) && pSet.has(p + 2)) {
        sumayyaConsecScore += 10;
      }
    }
    // Score any consecutive run of 4 or more heavily:
    for (let p = 1; p <= 5; p++) {
      if (pSet.has(p) && pSet.has(p + 1) && pSet.has(p + 2) && pSet.has(p + 3)) {
        sumayyaConsecScore += 50;
      }
    }
  }

  // 5. English in P8
  let engP8 = 0;
  for (const s of currentSlots) {
    if (s.period_index === 8 && s.subject_name.includes('ENG')) engP8++;
  }

  // 6. Junior adjacent different subject violations
  let jrAdj = 0;
  for (const jc of ['JS 1', 'JS 2', 'JS 3']) {
    for (const d of days) {
      const jSlots = currentSlots.filter(s => s.class_name === jc && s.day === d).sort((a, b) => a.period_index - b.period_index);
      for (let k = 0; k < jSlots.length - 1; k++) {
        const a = jSlots[k];
        const b = jSlots[k + 1];
        if (a.period_index + 1 === b.period_index && a.teacher_id === b.teacher_id && a.subject_id !== b.subject_id) {
          jrAdj++;
        }
      }
    }
  }

  const totalPenalty = clashes * 1000 + classClashes * 1000 + p8Score * 100 + engP8 * 500 + jrAdj * 200 + sumayyaConsecScore;
  return { totalPenalty, clashes, classClashes, p8Score, sumayyaConsecScore, jrAdj, sumayyaDaily };
}

console.log('Current baseline:', evaluate(slots));

// We want sumayyaConsecScore === 0! (NO 3 consecutive periods anywhere for Sumayya!)
// Let's find single, double, or triple swaps that reach sumayyaConsecScore === 0 with totalPenalty === 0!
// Intra-class swaps only:
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];

function getValidIntraSwaps(currentSlots) {
  const list = [];
  for (const c of classes) {
    const cSlots = currentSlots.filter(r => r.class_name === c);
    for (let i = 0; i < cSlots.length; i++) {
      for (let j = i + 1; j < cSlots.length; j++) {
        const s1 = cSlots[i];
        const s2 = cSlots[j];
        if (s1.day === s2.day && s1.period_index === s2.period_index) continue;
        const isP = (s) => ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(s.subject_name);
        if (isP(s1) || isP(s2)) continue;
        if (s1.period_index === 8 && s2.period_index !== 8) continue;
        if (s2.period_index === 8 && s1.period_index !== 8) continue;
        if ((s1.subject_name.includes('ENG') && s2.period_index === 8) || (s2.subject_name.includes('ENG') && s1.period_index === 8)) continue;
        if (s1.day === 'Friday' && s2.day !== 'Friday' && (c.startsWith('JS') ? s2.period_index > 4 : s2.period_index > 6)) continue;
        if (s2.day === 'Friday' && s1.day !== 'Friday' && (c.startsWith('JS') ? s1.period_index > 4 : s1.period_index > 6)) continue;
        if ((s1.teacher_name.includes('Shehu') || s1.teacher_name.includes('Kabir')) && s2.day === 'Friday') continue;
        if ((s2.teacher_name.includes('Shehu') || s2.teacher_name.includes('Kabir')) && s1.day === 'Friday') continue;

        // Check clashes
        const clash1 = currentSlots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s1.teacher_id && r.day === s2.day && r.period_index === s2.period_index);
        const clash2 = currentSlots.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s2.teacher_id && r.day === s1.day && r.period_index === s1.period_index);
        if (clash1 || clash2) continue;

        list.push({ s1, s2, c });
      }
    }
  }
  return list;
}

const initialSwaps = getValidIntraSwaps(slots);
console.log('Valid initial intra swaps:', initialSwaps.length);

// Search for sequence of swaps (length 1, 2, or 3) that eliminates Sumayya 3-consec runs:
let bestSol = null;
let minConsec = evaluate(slots).sumayyaConsecScore;

for (const sw1 of initialSwaps) {
  const sim1 = slots.map(r => {
    if (r.id === sw1.s1.id) return { ...r, day: sw1.s2.day, period_index: sw1.s2.period_index };
    if (r.id === sw1.s2.id) return { ...r, day: sw1.s1.day, period_index: sw1.s1.period_index };
    return r;
  });
  const ev1 = evaluate(sim1);
  if (ev1.totalPenalty === 0) {
    bestSol = { swaps: [sw1], state: sim1, ev: ev1 };
    break;
  }
  if (ev1.clashes === 0 && ev1.classClashes === 0 && ev1.p8Score === 0 && ev1.jrAdj === 0) {
    // Try second swap
    const swaps2 = getValidIntraSwaps(sim1);
    for (const sw2 of swaps2) {
      const sim2 = sim1.map(r => {
        if (r.id === sw2.s1.id) return { ...r, day: sw2.s2.day, period_index: sw2.s2.period_index };
        if (r.id === sw2.s2.id) return { ...r, day: sw2.s1.day, period_index: sw2.s1.period_index };
        return r;
      });
      const ev2 = evaluate(sim2);
      if (ev2.totalPenalty === 0) {
        bestSol = { swaps: [sw1, sw2], state: sim2, ev: ev2 };
        break;
      }
      if (ev2.sumayyaConsecScore < minConsec && ev2.clashes === 0 && ev2.classClashes === 0 && ev2.p8Score === 0 && ev2.jrAdj === 0) {
        minConsec = ev2.sumayyaConsecScore;
        bestSol = { swaps: [sw1, sw2], state: sim2, ev: ev2 };
      }
    }
    if (bestSol && bestSol.ev.totalPenalty === 0) break;
  }
}

if (bestSol) {
  console.log('Found solution!');
  console.log('Result eval:', bestSol.ev);
  console.log('Swaps applied:');
  for (const sw of bestSol.swaps) {
    console.log(`  ${sw.c}: [${sw.s1.day} P${sw.s1.period_index}] ${sw.s1.subject_name} (${sw.s1.teacher_name}) <--> [${sw.s2.day} P${sw.s2.period_index}] ${sw.s2.subject_name} (${sw.s2.teacher_name})`);
  }

  // Print Sumayya's new schedule
  console.log('\n--- M. SUMAYYA BALANCED SCHEDULE ---');
  for (const d of days) {
    const dSlots = bestSol.state.filter(r => r.teacher_name.includes('Sumayya') && r.day === d);
    const map = {};
    dSlots.forEach(r => map[r.period_index] = r.class_name + ' ' + r.subject_name);
    console.log(d.padEnd(10) + ': ' + [1, 2, 3, 4, 5, 6, 7, 8].map(p => map[p] ? `[P${p}: ${map[p]}]` : `[P${p}: ---]`).join(' '));
  }

  // Apply to SQLite and JSON
  const updateStmt = db.prepare('UPDATE timetable_slots SET day = ?, period_index = ? WHERE id = ?');
  for (const s of bestSol.state) {
    const orig = slots.find(r => r.id === s.id);
    if (orig.day !== s.day || orig.period_index !== s.period_index) {
      updateStmt.run(s.day, s.period_index, s.id);
    }
  }

  const allSlots = db.prepare(`
    SELECT class_id, subject_id, teacher_id, day, period_index, is_locked
    FROM timetable_slots
    ORDER BY day, period_index, class_id
  `).all();

  fs.writeFileSync('server/data/solved_246_slots.json', JSON.stringify(allSlots, null, 2), 'utf8');
  console.log('Saved to server/data/solved_246_slots.json and SQLite!');
} else {
  console.log('No 2-swap solution found with 0 consecutive runs.');
}
