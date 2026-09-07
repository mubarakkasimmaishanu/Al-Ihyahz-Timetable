---
name: timetable-scheduling
description: >-
  Generate, balance, validate, and manage conflict-free school timetables for Al-Ihyaz Academy.
  Use when adding or modifying teacher allocations, running the scheduling engine, verifying paired electives
  (Government-Physics, Literature-Chemistry), enforcing the 50/50 before/after break balance, or inspecting timetable sheets.
---

# Timetable Scheduling Skill for Al-Ihyaz Academy

This skill guides the agent through generating, balancing, validating, and updating timetables for Al-Ihyaz Academy using the conflict-free constraint solver engine.

---

## 1. Quick Reference & Core Rules

Before modifying schedules or allocations, always verify against the workspace rules:
- **Teacher Naming Rule**: Always use the exact pattern `M. Hassan`, `M. Shehu`, `M. Mubarak`, `M. Nana Firdaus`. Never use raw codes (`MHN`, `MSH`, `MMB`, `MNF`) in place of names. See [Teacher Naming Rules](../../rules/teacher-naming-rules.md).
- **Scheduling Constraints**: Enforce the 50/50 balance before/after break (P1–P4 vs P5–P8), preserve all contacts without silent reduction, and respect teacher time preferences. See [Timetable Scheduling Rules](../../rules/timetable-scheduling-rules.md).
- **Teacher Notices**: Check individual requirements for:
  - [M. Shehu](../../notices/notice-m-shehu.md) (Morning Only)
  - [M. Mubarak](../../notices/notice-m-mubarak.md)
  - [M. Hassan](../../notices/notice-m-hassan.md) (Paired Gov & Lit)
  - [M. Nana Firdaus](../../notices/notice-m-nana-firdaus.md) (Paired Chem & BST)

---

## 2. Standard Workflow Procedures

### Procedure A: Adding or Updating Teacher Allocations
1. Check the teacher's profile and notice in `.agents/notices/`.
2. Determine required weekly contacts (e.g., 4 contacts per class = 12 contacts for 3 classes).
3. Check paired arrangement:
   - If Senior Arts/Science elective, pair simultaneously with the complementary subject (e.g., `Government ↔ Physics` or `Literature ↔ Chemistry`).
4. Update `server/db/seed.js` with `addAlloc(className, subjectCode, teacherCode, periods, allowDouble)`.
5. Run the seed script:
   ```powershell
   node server/db/seed.js
   ```

### Procedure B: Running Generation & Verification
1. Execute the test validation script:
   ```powershell
   node server/test-engine.js
   ```
2. Verify:
   - Total placed slots matches expected total (e.g. 89 slots).
   - Validation report returns `isValid: true` and `conflictCount: 0`.
   - Zero teacher double-booking and zero class clashes.
   - 100% paired alignment in Senior Secondary classes.

### Procedure C: Triggering Generation via API
1. If dev server is running, trigger regeneration via HTTP POST:
   ```powershell
   node -e "fetch('http://localhost:5000/api/timetable/generate', {method:'POST'}).then(r=>r.json()).then(console.log)"
   ```
2. Verify API validation:
   ```powershell
   node -e "fetch('http://localhost:5000/api/timetable/validate').then(r=>r.json()).then(console.log)"
   ```

---

## 3. Paired Elective Scheduling Implementation

The generator engine implements paired electives using joint lesson units (`isPaired: true`):
* **Unit Decomposition**: 4-contact paired subjects are decomposed into:
  - 1 Double period unit (duration: 2)
  - 2 Single period units (duration: 1)
* **Slot Placement**: Placed simultaneously in the class schedule:
  ```javascript
  classSchedule[unit.class_id][day][period] = [slotA, slotB];
  teacherSchedule[allocA.teacher_id][day][period] = slotA;
  teacherSchedule[allocB.teacher_id][day][period] = slotB;
  ```
* **Morning / Afternoon Alignment**:
  - `Government ↔ Physics`: Assigned in Morning (P1–P4/5) because M. Shehu is MORNING_ONLY.
  - `Literature ↔ Chemistry`: Assigned in Afternoon (P5–P8) to achieve M. Hassan's and M. Nana Firdaus's 50/50 balance.
  - `Basic Science & Technology`: Assigned in Morning (P1–P4) for M. Nana Firdaus to balance her 12 afternoon Chemistry periods.
