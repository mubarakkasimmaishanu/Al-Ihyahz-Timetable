import { db } from './db/database.js';

const teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all();
const slots = db.prepare(`
  SELECT ts.id, ts.teacher_id, ts.day, ts.period_index, c.name as class_name, s.name as subject_name
  FROM timetable_slots ts
  JOIN classes c ON c.id = ts.class_id
  JOIN subjects s ON s.id = ts.subject_id
  ORDER BY ts.day, ts.period_index
`).all();

console.log('=== TEACHER FLOW & WORKLOAD REPORT ===\n');

for (const t of teachers) {
  const tSlots = slots.filter(s => s.teacher_id === t.id);
  if (tSlots.length === 0) continue;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayLoads = {};
  let p8Count = 0;
  let p7Count = 0;
  let maxConsecutive = 0;
  const backToBackAlerts = [];

  for (const d of days) {
    const dSlots = tSlots.filter(s => s.day === d).sort((a,b) => a.period_index - b.period_index);
    dayLoads[d] = dSlots.length;
    
    // Check consecutive runs
    let consec = 0;
    let lastP = -99;
    for (const s of dSlots) {
      if (s.period_index === lastP + 1) {
        consec++;
      } else {
        consec = 1;
      }
      lastP = s.period_index;
      if (consec > maxConsecutive) maxConsecutive = consec;
    }
    
    // Find consecutive blocks of 3 or more
    let currentBlock = [];
    for (let i = 0; i < dSlots.length; i++) {
      if (currentBlock.length === 0) {
        currentBlock.push(dSlots[i]);
      } else {
        const prev = currentBlock[currentBlock.length - 1];
        if (dSlots[i].period_index === prev.period_index + 1) {
          currentBlock.push(dSlots[i]);
        } else {
          if (currentBlock.length >= 3) {
            backToBackAlerts.push(d + ': ' + currentBlock.map(s => `P${s.period_index}(${s.class_name} ${s.subject_name})`).join(' -> '));
          }
          currentBlock = [dSlots[i]];
        }
      }
    }
    if (currentBlock.length >= 3) {
      backToBackAlerts.push(d + ': ' + currentBlock.map(s => `P${s.period_index}(${s.class_name} ${s.subject_name})`).join(' -> '));
    }

    p8Count += dSlots.filter(s => s.period_index === 8).length;
    p7Count += dSlots.filter(s => s.period_index === 7).length;
  }

  const p14 = tSlots.filter(s => s.period_index <= 4).length;
  const p58 = tSlots.filter(s => s.period_index >= 5).length;

  console.log(`Teacher: ${t.name.padEnd(16)} | Total: ${tSlots.length.toString().padStart(2)} | P1-4: ${p14.toString().padStart(2)} | P5-8: ${p58.toString().padStart(2)} | P7: ${p7Count} | P8: ${p8Count} | MaxConsec: ${maxConsecutive}`);
  console.log('   Daily Load:', JSON.stringify(dayLoads));
  if (backToBackAlerts.length > 0) {
    console.log('   Runs >= 3 in a row:\n     * ' + backToBackAlerts.join('\n     * '));
  }
  console.log('');
}
