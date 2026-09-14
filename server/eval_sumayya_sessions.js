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

// Helper to check valid schedule
function evaluateSchedule(slots) {
  let clashes = 0;
  // Check teacher clashes: (teacher_id, day, period_index) unique
  const tMap = new Map();
  const cMap = new Map();
  for (const s of slots) {
    const tKey = `${s.teacher_id}-${s.day}-${s.period_index}`;
    if (tMap.has(tKey)) clashes++;
    tMap.set(tKey, true);

    const cKey = `${s.class_id}-${s.day}-${s.period_index}`;
    // paired electives share class_id, day, period_index (e.g. Gov/Phy, Chm/Eco, Bio/Lit)
    // but single subjects should not clash
  }

  // P8 distribution
  const p8Count = {};
  for (const s of slots) {
    if (s.period_index === 8) {
      p8Count[s.teacher_name] = (p8Count[s.teacher_name] || 0) + 1;
    }
  }

  // Sumayya consecutive runs without break
  // Mon-Thu: morning is P1-P4, afternoon is P5-P8.
  // Within a session (morning or afternoon), consecutive periods > 2 is tiring, >= 4 is exhausting.
  // Even across break (P4 to P5), back-to-back doubles is tiring.
  let sumayyaMaxSessionConsec = 0;
  let sumayyaDetails = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const d of days) {
    const dSlots = slots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    const pSet = new Set(dSlots.map(s => s.period_index));
    
    // Morning run (P1-P4)
    let mRun = 0, maxM = 0;
    for (let p = 1; p <= 4; p++) {
      if (pSet.has(p)) { mRun++; if (mRun > maxM) maxM = mRun; }
      else mRun = 0;
    }

    // Afternoon run (P5-P8)
    let aRun = 0, maxA = 0;
    for (let p = 5; p <= 8; p++) {
      if (pSet.has(p)) { aRun++; if (aRun > maxA) maxA = aRun; }
      else aRun = 0;
    }

    if (maxM > sumayyaMaxSessionConsec) sumayyaMaxSessionConsec = maxM;
    if (maxA > sumayyaMaxSessionConsec) sumayyaMaxSessionConsec = maxA;

    if (maxM >= 3) sumayyaDetails.push(`${d} Morning: ${maxM} consecutive`);
    if (maxA >= 3) sumayyaDetails.push(`${d} Afternoon: ${maxA} consecutive`);
  }

  return { clashes, p8Count, sumayyaMaxSessionConsec, sumayyaDetails };
}

console.log('Current evaluation:', evaluateSchedule(rows));
