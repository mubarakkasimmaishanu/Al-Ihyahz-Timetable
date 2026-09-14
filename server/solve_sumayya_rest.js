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

console.log('--- SEARCHING FOR VALID SWAPS TO BREAK SUMAYYA 4-PERIOD RUN ---');

// We want to change the schedule of slots such that:
// 1. Hard conflicts = 0
// 2. Sumayya has NO 4-consecutive run (and specifically on Thursday afternoon she gets rest!)
// 3. P8 distribution: exactly 3 for all 8 eligible teachers (Mubarak, Yusuf, Kabir, Sumayya, Abba, Amina, Maryam, Nabila; 0 for Shehu, Hassan, Firdaus).
// 4. No English in P8.
// 5. No adjacent different subjects in Junior classes.
// 6. Friday JS <= 4, SS <= 6.

// Let's test intra-class swaps (within the same class between two periods/days) or inter-class swaps.
// Intra-class swap: Swap slot A and slot B within the same class. This preserves subject counts and class integrity automatically!
// We only need to check:
// - Teacher clash for A's teacher at B's (day, period)
// - Teacher clash for B's teacher at A's (day, period)
// - Both teachers available at the new slots
// - P8 constraints (if A or B is period 8)
// - English placement rules (if A or B is English, no P8, no Fri P5/P6)
// - Paired elective rules (Gov/Phy, Chm/Eco, Bio/Lit must stay together)
// - Adjacent different subjects check in Junior.

function getSumayyaThursdayAfternoonRun(slots) {
  const sumThuAft = slots.filter(s => s.teacher_name.includes('Sumayya') && s.day === 'Thursday' && s.period_index >= 5);
  const pSet = new Set(sumThuAft.map(s => s.period_index));
  let run = 0, maxRun = 0;
  for (let p = 5; p <= 8; p++) {
    if (pSet.has(p)) { run++; if (run > maxRun) maxRun = run; }
    else run = 0;
  }
  return maxRun;
}

console.log('Initial Sumayya Thursday afternoon max consecutive:', getSumayyaThursdayAfternoonRun(rows));

// Let's find single intra-class swaps that reduce this run to <= 2 or 3
const classes = ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3'];

for (const c of classes) {
  const cSlots = rows.filter(r => r.class_name === c);
  for (let i = 0; i < cSlots.length; i++) {
    for (let j = i + 1; j < cSlots.length; j++) {
      const s1 = cSlots[i];
      const s2 = cSlots[j];

      // Don't swap identical day and period
      if (s1.day === s2.day && s1.period_index === s2.period_index) continue;

      // Don't break paired electives (Gov/Phy, Chm/Eco, Bio/Lit)
      if (s1.subject_name.includes('/') || s2.subject_name.includes('/')) continue;
      const isPaired = (s) => ['GOVT', 'PHY', 'CHEM', 'ECON', 'BIO', 'LIT'].includes(s.subject_name);
      if (isPaired(s1) || isPaired(s2)) continue;

      // Check if this swap affects Sumayya
      const involvesSumayya = s1.teacher_name.includes('Sumayya') || s2.teacher_name.includes('Sumayya');
      if (!involvesSumayya) continue;

      // Check teacher clashes for s1.teacher at s2.(day, period) and s2.teacher at s1.(day, period)
      // s1.teacher:
      const clash1 = rows.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s1.teacher_id && r.day === s2.day && r.period_index === s2.period_index);
      const clash2 = rows.some(r => r.id !== s1.id && r.id !== s2.id && r.teacher_id === s2.teacher_id && r.day === s1.day && r.period_index === s1.period_index);

      if (clash1 || clash2) continue;

      // Check P8 constraints:
      // If s1.period_index === 8 or s2.period_index === 8:
      if (s1.period_index === 8 || s2.period_index === 8) {
        // If swapping within P8, count doesn't change.
        if (s1.period_index !== s2.period_index) {
          // One is P8 and other is not:
          // s1 moving to s2, s2 moving to s1.
          // Would change P8 teacher counts!
          // We only allow if both teachers have 3 P8 before and after, or if both are Sumayya (e.g. COMP).
          if (s1.teacher_id !== s2.teacher_id) continue; // skip changing P8 teacher counts for now
        }
      }

      // Check English in P8:
      if ((s1.subject_name.includes('ENG') && s2.period_index === 8) || (s2.subject_name.includes('ENG') && s1.period_index === 8)) continue;

      // Check Friday closing limits:
      if (s1.day === 'Friday' && s2.day !== 'Friday') {
        if (c.startsWith('JS') && s2.period_index > 4) continue;
        if (c.startsWith('SS') && s2.period_index > 6) continue;
      }
      if (s2.day === 'Friday' && s1.day !== 'Friday') {
        if (c.startsWith('JS') && s1.period_index > 4) continue;
        if (c.startsWith('SS') && s1.period_index > 6) continue;
      }

      // Simulate swap
      const simulated = rows.map(r => {
        if (r.id === s1.id) return { ...r, day: s2.day, period_index: s2.period_index };
        if (r.id === s2.id) return { ...r, day: s1.day, period_index: s1.period_index };
        return r;
      });

      const newRun = getSumayyaThursdayAfternoonRun(simulated);
      if (newRun < 4) {
        console.log(`FOUND VALID SWAP in ${c}:`);
        console.log(`  [${s1.day} P${s1.period_index}] ${s1.subject_name} (${s1.teacher_name}) <--> [${s2.day} P${s2.period_index}] ${s2.subject_name} (${s2.teacher_name})`);
        console.log(`  -> New Sumayya Thursday afternoon consecutive: ${newRun}`);
      }
    }
  }
}
