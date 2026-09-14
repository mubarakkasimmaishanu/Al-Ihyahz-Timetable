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
  // Hard clashes
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
  let maxConsecWeek = 0;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const d of days) {
    const dSlots = currentSlots.filter(s => s.teacher_name.includes('Sumayya') && s.day === d);
    const dSet = new Set(dSlots.map(s => s.period_index));
    let dRun = 0;
    for (let p = 1; p <= 8; p++) {
      if (dSet.has(p)) { dRun++; if (dRun > maxConsecWeek) maxConsecWeek = dRun; }
      else dRun = 0;
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

  return { clashes, p8, maxRunThu, maxConsecWeek, jrAdjViolations };
}

console.log('Current baseline:', evaluate(slots));

// We want maxRunThu <= 2 or 3 (ideally 2, with P7 free!), and maxConsecWeek <= 3!
// Let's test swaps involving JS 1 on Thursday:
// Target: JS 1 Thursday P7 COMP (id 1439).
// What if JS 1 Thursday P7 COMP swaps with another JS 1 slot?
const js1ThuComp = slots.find(s => s.class_name === 'JS 1' && s.day === 'Thursday' && s.period_index === 7);
console.log('JS 1 Thursday P7 COMP:', js1ThuComp);

// Let's test all other JS 1 slots for swapping with JS 1 Thursday P7:
const js1Slots = slots.filter(s => s.class_name === 'JS 1' && s.id !== js1ThuComp.id);
for (const s of js1Slots) {
  if (s.period_index === 8) continue; // preserve P8
  // Check if Sumayya is free at s.day, s.period_index
  const sumayyaBusy = slots.some(r => r.teacher_name.includes('Sumayya') && r.day === s.day && r.period_index === s.period_index);
  if (sumayyaBusy) continue;
  // Check if s.teacher is free at Thursday P7
  const teacherBusy = slots.some(r => r.teacher_id === s.teacher_id && r.day === 'Thursday' && r.period_index === 7);
  if (teacherBusy) continue;
  // Check Shehu / Kabir Friday
  if (s.teacher_name.includes('Shehu') && s.day === 'Friday') continue;
  if (s.teacher_name.includes('Kabir') && s.day === 'Friday') continue;

  const sim = slots.map(r => {
    if (r.id === js1ThuComp.id) return { ...r, day: s.day, period_index: s.period_index };
    if (r.id === s.id) return { ...r, day: js1ThuComp.day, period_index: js1ThuComp.period_index };
    return r;
  });

  const ev = evaluate(sim);
  if (ev.clashes === 0 && ev.maxRunThu < 4 && ev.jrAdjViolations === 0) {
    console.log(`Potential direct swap with ${s.day} P${s.period_index} ${s.subject_name} (${s.teacher_name}):`);
    console.log(`  Thursday afternoon run: ${ev.maxRunThu}, Week max consec: ${ev.maxConsecWeek}`);
  }
}
