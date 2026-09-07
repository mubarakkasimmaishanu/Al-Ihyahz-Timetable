/**
 * aSc-Inspired School Timetable Conflict-Free Generator Engine
 * Specially tuned for Northern Nigerian Secondary Schools.
 * Includes support for simultaneous paired elective subjects (e.g. Government ↔ Physics, Literature ↔ Chemistry).
 */

const PAIRED_SUBJECT_PAIRS = [
  ['GOV', 'PHY'],
  ['LIT', 'CHM']
];

export class TimetableGenerator {
  constructor(options = {}) {
    this.days = options.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    this.regularPeriods = options.regularPeriods || 8;
    this.fridayPeriods = options.fridayPeriods || 6;
    this.maxRestarts = options.maxRestarts || 40;
    this.maxIterations = options.maxIterations || 15000;
  }

  /**
   * Get maximum available period index for a given day
   */
  getMaxPeriodsForDay(day) {
    return day === 'Friday' ? this.fridayPeriods : this.regularPeriods;
  }

  /**
   * Check if an allocation can legally fit into the school calendar
   */
  preValidate(classes, teachers, subjects, allocations) {
    const diagnostics = [];
    const totalWeeklySlots = (this.days.length - 1) * this.regularPeriods + this.fridayPeriods;
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

    // 1. Check each class total periods (paired simultaneous electives only take 1 slot)
    const classLoads = {};
    const classAllocs = {};
    for (const alloc of allocations) {
      if (!classAllocs[alloc.class_id]) classAllocs[alloc.class_id] = [];
      classAllocs[alloc.class_id].push(alloc);
    }

    for (const [classId, allocList] of Object.entries(classAllocs)) {
      let load = 0;
      const accountedIds = new Set();

      for (const [codeA, codeB] of PAIRED_SUBJECT_PAIRS) {
        const a = allocList.find(al => !accountedIds.has(al.id) && subjectMap[al.subject_id]?.code === codeA);
        const b = allocList.find(al => !accountedIds.has(al.id) && subjectMap[al.subject_id]?.code === codeB);
        if (a && b) {
          accountedIds.add(a.id);
          accountedIds.add(b.id);
          load += Math.max(a.periods_per_week, b.periods_per_week);
        }
      }

      for (const al of allocList) {
        if (!accountedIds.has(al.id)) {
          load += al.periods_per_week;
        }
      }

      classLoads[classId] = load;
      const cls = classes.find(c => c.id === Number(classId));
      const className = cls ? cls.name : `Class #${classId}`;
      if (load > totalWeeklySlots) {
        diagnostics.push({
          type: 'ERROR',
          code: 'CLASS_OVERLOAD',
          message: `Class "${className}" requires ${load} periods, but only ${totalWeeklySlots} slots are available in the week.`
        });
      }
    }

    // 2. Check each teacher total load
    const teacherLoads = {};
    for (const alloc of allocations) {
      teacherLoads[alloc.teacher_id] = (teacherLoads[alloc.teacher_id] || 0) + alloc.periods_per_week;
    }

    for (const [teacherId, load] of Object.entries(teacherLoads)) {
      const t = teachers.find(tch => tch.id === Number(teacherId));
      const teacherName = t ? t.name : `Teacher #${teacherId}`;
      let maxTeacherSlots = totalWeeklySlots;
      if (t?.unavailable_days) {
        let unav = [];
        try {
          unav = typeof t.unavailable_days === 'string' ? JSON.parse(t.unavailable_days) : t.unavailable_days;
        } catch {
          unav = t.unavailable_days.split(',').map(s => s.trim());
        }
        if (Array.isArray(unav)) {
          for (const d of unav) {
            maxTeacherSlots -= (d === 'Friday' ? this.fridayPeriods : this.regularPeriods);
          }
        }
      }
      if (load > maxTeacherSlots) {
        diagnostics.push({
          type: 'ERROR',
          code: 'TEACHER_OVERLOAD',
          message: `Teacher "${teacherName}" is assigned ${load} periods, exceeding their available weekly periods (${maxTeacherSlots}).`
        });
      }
    }

    return {
      valid: diagnostics.filter(d => d.type === 'ERROR').length === 0,
      diagnostics
    };
  }

  /**
   * Generate conflict-free timetable
   */
  generate(classes, teachers, subjects, allocations, lockedSlots = []) {
    const validation = this.preValidate(classes, teachers, subjects, allocations);
    if (!validation.valid) {
      return {
        success: false,
        diagnostics: validation.diagnostics,
        slots: []
      };
    }

    let bestResult = null;
    let minConflicts = Infinity;

    for (let restart = 0; restart < this.maxRestarts; restart++) {
      const result = this._attemptSolve(
        classes,
        teachers,
        subjects,
        allocations,
        lockedSlots,
        restart > 0 // Add stochastic shuffling on restarts
      );

      if (result.success) {
        return {
          success: true,
          restarts: restart,
          diagnostics: [{ type: 'SUCCESS', message: '100% Conflict-free timetable generated successfully.' }],
          slots: result.slots
        };
      }

      if (result.unplacedCount < minConflicts) {
        minConflicts = result.unplacedCount;
        bestResult = result;
      }
    }

    // If exact 100% solution wasn't found in initial passes, return best effort with diagnostic warnings
    return {
      success: false,
      diagnostics: [
        {
          type: 'WARNING',
          message: `Generator placed ${bestResult.slots.length} periods, but ${bestResult.unplacedCount} periods could not be scheduled without conflict.`
        },
        ...bestResult.diagnostics
      ],
      slots: bestResult.slots
    };
  }

  _attemptSolve(classes, teachers, subjects, allocations, lockedSlots, stochastic = false) {
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

    const classSchedule = {};
    const teacherSchedule = {};
    const classDaySubjectCount = {};
    const teacherDayPeriodCount = {};
    const teacherPeriodCount = {};
    const classDayPeriodCount = {};
    const teacherBeforeBreakCount = {};
    const teacherAfterBreakCount = {};
    const classBeforeBreakCount = {};
    const classAfterBreakCount = {};

    for (const c of classes) {
      classSchedule[c.id] = {};
      classDaySubjectCount[c.id] = {};
      classDayPeriodCount[c.id] = {};
      classBeforeBreakCount[c.id] = 0;
      classAfterBreakCount[c.id] = 0;
      for (const d of this.days) {
        classSchedule[c.id][d] = {};
        classDaySubjectCount[c.id][d] = {};
        classDayPeriodCount[c.id][d] = 0;
      }
    }

    const teacherDaySubjectCount = {};
    const teacherDayBeforeBreakCount = {};
    const teacherDayAfterBreakCount = {};
    for (const t of teachers) {
      teacherSchedule[t.id] = {};
      teacherDayPeriodCount[t.id] = {};
      teacherDaySubjectCount[t.id] = {};
      teacherPeriodCount[t.id] = {};
      teacherBeforeBreakCount[t.id] = 0;
      teacherAfterBreakCount[t.id] = 0;
      teacherDayBeforeBreakCount[t.id] = {};
      teacherDayAfterBreakCount[t.id] = {};
      for (let p = 1; p <= this.regularPeriods; p++) {
        teacherPeriodCount[t.id][p] = 0;
      }
      for (const d of this.days) {
        teacherSchedule[t.id][d] = {};
        teacherDayPeriodCount[t.id][d] = 0;
        teacherDaySubjectCount[t.id][d] = {};
        teacherDayBeforeBreakCount[t.id][d] = 0;
        teacherDayAfterBreakCount[t.id][d] = 0;
      }
    }

    const placedSlots = [];

    // Apply locked slots first (if any)
    for (const lock of lockedSlots) {
      if (!classSchedule[lock.class_id][lock.day][lock.period_index]) {
        classSchedule[lock.class_id][lock.day][lock.period_index] = [];
      }
      classSchedule[lock.class_id][lock.day][lock.period_index].push(lock);
      teacherSchedule[lock.teacher_id][lock.day][lock.period_index] = lock;
      classDaySubjectCount[lock.class_id][lock.day][lock.subject_id] = 
        (classDaySubjectCount[lock.class_id][lock.day][lock.subject_id] || 0) + 1;
      teacherDayPeriodCount[lock.teacher_id][lock.day]++;
      teacherDaySubjectCount[lock.teacher_id][lock.day][lock.subject_id] = 
        (teacherDaySubjectCount[lock.teacher_id][lock.day][lock.subject_id] || 0) + 1;
      teacherPeriodCount[lock.teacher_id][lock.period_index] = 
        (teacherPeriodCount[lock.teacher_id][lock.period_index] || 0) + 1;
      classDayPeriodCount[lock.class_id][lock.day] = 
        (classDayPeriodCount[lock.class_id][lock.day] || 0) + 1;

      if (lock.period_index <= 4) {
        teacherBeforeBreakCount[lock.teacher_id] = (teacherBeforeBreakCount[lock.teacher_id] || 0) + 1;
        teacherDayBeforeBreakCount[lock.teacher_id][lock.day] = (teacherDayBeforeBreakCount[lock.teacher_id][lock.day] || 0) + 1;
        classBeforeBreakCount[lock.class_id] = (classBeforeBreakCount[lock.class_id] || 0) + 1;
      } else {
        teacherAfterBreakCount[lock.teacher_id] = (teacherAfterBreakCount[lock.teacher_id] || 0) + 1;
        teacherDayAfterBreakCount[lock.teacher_id][lock.day] = (teacherDayAfterBreakCount[lock.teacher_id][lock.day] || 0) + 1;
        classAfterBreakCount[lock.class_id] = (classAfterBreakCount[lock.class_id] || 0) + 1;
      }
      placedSlots.push(lock);
    }

    // Identify Paired Allocations (e.g. Government ↔ Physics, Literature ↔ Chemistry in same class)
    const classAllocs = {};
    for (const a of allocations) {
      if (!classAllocs[a.class_id]) classAllocs[a.class_id] = [];
      classAllocs[a.class_id].push(a);
    }

    const lessonUnits = [];
    const usedAllocIds = new Set();

    for (const [classId, allocList] of Object.entries(classAllocs)) {
      for (const [codeA, codeB] of PAIRED_SUBJECT_PAIRS) {
        const allocA = allocList.find(a => !usedAllocIds.has(a.id) && subjectMap[a.subject_id]?.code === codeA);
        const allocB = allocList.find(a => !usedAllocIds.has(a.id) && subjectMap[a.subject_id]?.code === codeB);

        if (allocA && allocB && allocA.periods_per_week === allocB.periods_per_week) {
          usedAllocIds.add(allocA.id);
          usedAllocIds.add(allocB.id);

          let remaining = allocA.periods_per_week;
          const maxDoubles = Math.min(
            typeof allocA.allow_double === 'number' ? allocA.allow_double : (allocA.allow_double ? 1 : 0),
            typeof allocB.allow_double === 'number' ? allocB.allow_double : (allocB.allow_double ? 1 : 0)
          );

          let doublesCreated = 0;
          while (doublesCreated < maxDoubles && remaining >= 2) {
            doublesCreated++;
            lessonUnits.push({
              isPaired: true,
              class_id: Number(classId),
              duration: 2,
              unitId: `paired_${allocA.id}_${allocB.id}_d${doublesCreated}`,
              allocA,
              allocB
            });
            remaining -= 2;
          }

          while (remaining > 0) {
            lessonUnits.push({
              isPaired: true,
              class_id: Number(classId),
              duration: 1,
              unitId: `paired_${allocA.id}_${allocB.id}_s${remaining}`,
              allocA,
              allocB
            });
            remaining -= 1;
          }
        }
      }
    }

    // Unpaired allocations become regular single units
    for (const alloc of allocations) {
      if (usedAllocIds.has(alloc.id)) continue;
      let remaining = alloc.periods_per_week;
      const maxDoubles = typeof alloc.allow_double === 'number' ? alloc.allow_double : (alloc.allow_double ? 1 : 0);
      let doublesCreated = 0;
      while (doublesCreated < maxDoubles && remaining >= 2) {
        doublesCreated++;
        lessonUnits.push({
          isPaired: false,
          class_id: alloc.class_id,
          duration: 2,
          unitId: `${alloc.id}_d${doublesCreated}`,
          alloc
        });
        remaining -= 2;
      }
      while (remaining > 0) {
        lessonUnits.push({
          isPaired: false,
          class_id: alloc.class_id,
          duration: 1,
          unitId: `${alloc.id}_s${remaining}`,
          alloc
        });
        remaining -= 1;
      }
    }

    // Sort lesson units by MRV (Most Constrained Variable first):
    // 1. Units with MORNING_ONLY teachers (e.g. Shehu with PHY/GOV)
    // 2. Paired units
    // 3. Doubles before singles
    // 4. Higher class load
    lessonUnits.sort((a, b) => {
      const isMorningOnly = (unit) => {
        if (unit.isPaired) {
          const tA = teacherMap[unit.allocA.teacher_id];
          const tB = teacherMap[unit.allocB.teacher_id];
          return (tA?.time_preference === 'MORNING_ONLY' || tB?.time_preference === 'MORNING_ONLY') ? 1 : 0;
        }
        const t = teacherMap[unit.alloc.teacher_id];
        return t?.time_preference === 'MORNING_ONLY' ? 1 : 0;
      };

      const mA = isMorningOnly(a);
      const mB = isMorningOnly(b);
      if (mB !== mA) return mB - mA;

      const pA = a.isPaired ? 1 : 0;
      const pB = b.isPaired ? 1 : 0;
      if (pB !== pA) return pB - pA;

      if (b.duration !== a.duration) return b.duration - a.duration;
      if (stochastic) return Math.random() - 0.5;
      return a.class_id - b.class_id;
    });

    const unplaced = [];

    for (const unit of lessonUnits) {
      const candidates = [];
      const unitTeachers = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
      const unitSubjects = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];

      for (const day of this.days) {
        // Check teacher day availability (e.g. absent/unavailable days like Friday)
        let dayUnavailable = false;
        for (const tId of unitTeachers) {
          const teacher = teacherMap[tId];
          if (teacher?.unavailable_days) {
            let unavDays = [];
            try {
              unavDays = typeof teacher.unavailable_days === 'string'
                ? JSON.parse(teacher.unavailable_days)
                : teacher.unavailable_days;
            } catch {
              unavDays = teacher.unavailable_days.split(',').map(s => s.trim());
            }
            if (Array.isArray(unavDays) && unavDays.includes(day)) {
              dayUnavailable = true;
              break;
            }
          }
        }
        if (dayUnavailable) continue;

        const maxP = this.getMaxPeriodsForDay(day);

        for (let p = 1; p <= maxP; p++) {
          if (unit.duration === 2 && p >= maxP) continue;
          const p2 = unit.duration === 2 ? p + 1 : null;

          // 1. Check class free
          const cSlot1 = classSchedule[unit.class_id][day][p];
          const cSlot2 = p2 ? classSchedule[unit.class_id][day][p2] : null;
          if (cSlot1 || (p2 && cSlot2)) continue;

          // 2. Check all involved teachers free
          let allTeachersFree = true;
          for (const tId of unitTeachers) {
            const tSlot1 = teacherSchedule[tId][day][p];
            const tSlot2 = p2 ? teacherSchedule[tId][day][p2] : null;
            if (tSlot1 || (p2 && tSlot2)) {
              allTeachersFree = false;
              break;
            }
          }
          if (!allTeachersFree) continue;

          // 3. Double period rule: NEVER span across break (Break is between Period 4 and Period 5)
          if (unit.duration === 2 && p === 4) continue;

          // 4. Friday Paired Double Rule: Never place paired double periods on Friday (short 6-period day; keep doubles Mon-Thu)
          if (day === 'Friday' && unit.isPaired && unit.duration === 2) continue;

          // Calculate soft score heuristic
          let penalty = 0;

          // Identify specific paired elective combinations
          let isLitChm = false;
          let isGovPhy = false;
          if (unit.isPaired) {
            for (const sId of unitSubjects) {
              const code = (subjectMap[sId]?.code || subjectMap[sId]?.name || '').toUpperCase();
              if (code === 'LIT' || code === 'CHM' || code === 'CHEM') isLitChm = true;
              if (code === 'GOV' || code === 'GOVT' || code === 'PHY') isGovPhy = true;
            }
          }

          // Rule A: Government ↔ Physics must be in the morning (P1–P4/5) with M. Shehu
          if (isGovPhy && (p > 5 || (p2 && p2 > 5))) {
            continue; // M. Shehu cannot teach in afternoon
          }

          // Rule B: Literature ↔ Chemistry must be prioritized in the AFTERNOON (Periods 5–8)
          // Early morning periods (P1–P4) are strictly preserved for difficult subjects (Physics, Mathematics, BST)
          if (isLitChm) {
            if (p <= 4) {
              // Strongly penalize scheduling Literature before break
              penalty += 2500 * (5 - p);
            } else {
              // Reward afternoon periods (P5–P8)
              penalty -= 100;
            }
            if (day === 'Friday') {
              // Strongly avoid placing Literature / Chemistry on Friday
              penalty += 800;
            }
          }

          // Rule C: Mathematics Placement Rules:
          // 1. NEVER add Math in 2nd to the last period and last period:
          //    - On Monday-Thursday (8-period days): NEVER Period 7 or Period 8!
          //    - On Friday (6-period day): NEVER Period 5 or Period 6!
          // 2. First two periods in the morning (P1, P2) and after break (P5) are HIGHLY ENCOURAGED.
          const isMath = !unit.isPaired && unitSubjects.some(sId => {
            const sub = subjectMap[sId];
            const code = (sub?.code || '').toUpperCase();
            const name = (sub?.name || '').toUpperCase();
            return code === 'MTH' || name.includes('MATH');
          });

          if (isMath) {
            // Strict Hard Constraint: Never 2nd to last or last period of the day
            if (p >= 7 || (p2 && p2 >= 7)) {
              continue; // Disallowed in Period 7 and 8
            }
            if (day === 'Friday' && (p >= 5 || (p2 && p2 >= 5))) {
              continue; // On Friday, disallowed in Period 5 and 6
            }

            // Soft Heuristic: First two periods (P1, P2) and immediately after break (P5) are highly encouraged!
            if (p === 1 || p === 2 || p === 5 || p2 === 2) {
              penalty -= 220; // High reward for prime Math cognitive slots
            } else if (p === 3 || p === 4) {
              penalty -= 40; // Normal morning periods before break
            } else if (p === 6) {
              penalty += 350; // Heavy penalty for Period 6 (late afternoon)
            }
          }

          // 5. Friday Chemistry & Paired Elective load balancing:
          // Heavily limit / avoid overloading Friday with multiple Chemistry or Literature periods
          if (day === 'Friday' && unit.isPaired) {
            let maxCurrentCount = 0;
            for (let i = 0; i < unitTeachers.length; i++) {
              const tId = unitTeachers[i];
              const sId = unitSubjects[i];
              const cnt = teacherDaySubjectCount[tId]?.[day]?.[sId] || 0;
              if (cnt > maxCurrentCount) maxCurrentCount = cnt;
            }
            if (maxCurrentCount >= 1) {
              // Disallow 2 or more periods of Chemistry (or Literature) on Friday!
              continue;
            }
            penalty += 150;
          }

          for (const tId of unitTeachers) {
            const teacher = teacherMap[tId];
            if (teacher && teacher.time_preference === 'MORNING_ONLY') {
              if (p > 5 || (p2 && p2 > 5)) {
                penalty += 1500 * (p - 4); // strictly avoid afternoon periods 6, 7, 8
              } else if (p === 5) {
                penalty += 50; // allow period 5 if necessary, but prefer 1-4
              }
            } else {
              // General Rule: 50/50 balance across Before Break (P1-P4) and After Break (P5-P8)
              const tBefore = teacherBeforeBreakCount[tId] || 0;
              const tAfter = teacherAfterBreakCount[tId] || 0;
              const isMorning = p <= 4;

              if (isMorning) {
                if (tBefore >= tAfter) {
                  penalty += (tBefore - tAfter + unit.duration) * 50;
                }
              } else {
                if (tAfter >= tBefore) {
                  penalty += (tAfter - tBefore + unit.duration) * 50;
                }
              }

              const countAtP1 = teacherPeriodCount[tId]?.[p] || 0;
              const countAtP2 = p2 ? (teacherPeriodCount[tId]?.[p2] || 0) : 0;
              penalty += (countAtP1 + countAtP2) * 10;
            }

            // Teacher daily workload balancing (scaled down for Friday's 6-period schedule)
            const teacherDaily = teacherDayPeriodCount[tId][day] || 0;
            const maxDaily = (day === 'Friday') ? Math.min(teacher?.max_daily_periods || 5, 4) : (teacher?.max_daily_periods || 5);
            penalty += teacherDaily * 40;
            if (teacherDaily + unit.duration > maxDaily) {
              penalty += 1500 * (teacherDaily + unit.duration - maxDaily);
            }

            // Burnout Prevention: avoid clustering too many periods on one side of break in a single day
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;
            if (p <= 4 && dayBefore + unit.duration > 3) {
              penalty += 350 * (dayBefore + unit.duration - 3);
            } else if (p > 4 && dayAfter + unit.duration > 3) {
              penalty += 350 * (dayAfter + unit.duration - 3);
            }
          }

          // Avoid clustering same subject on same day in class
          for (const sId of unitSubjects) {
            const exCount = classDaySubjectCount[unit.class_id][day][sId] || 0;
            if (exCount > 0) penalty += 80;
          }

          // Class daily load balancing
          const classDaily = classDayPeriodCount[unit.class_id]?.[day] || 0;
          penalty += classDaily * 10;

          if (stochastic) {
            penalty += Math.floor(Math.random() * 10);
          }

          candidates.push({ day, period: p, duration: unit.duration, penalty });
        }
      }

      if (candidates.length === 0) {
        unplaced.push(unit);
        continue;
      }

      candidates.sort((a, b) => a.penalty - b.penalty);
      const chosen = candidates[0];

      // Place slot(s)
      for (let offset = 0; offset < chosen.duration; offset++) {
        const periodIdx = chosen.period + offset;

        if (unit.isPaired) {
          const slotA = {
            class_id: unit.class_id,
            subject_id: unit.allocA.subject_id,
            teacher_id: unit.allocA.teacher_id,
            day: chosen.day,
            period_index: periodIdx,
            is_locked: 0
          };
          const slotB = {
            class_id: unit.class_id,
            subject_id: unit.allocB.subject_id,
            teacher_id: unit.allocB.teacher_id,
            day: chosen.day,
            period_index: periodIdx,
            is_locked: 0
          };

          classSchedule[unit.class_id][chosen.day][periodIdx] = [slotA, slotB];
          teacherSchedule[unit.allocA.teacher_id][chosen.day][periodIdx] = slotA;
          teacherSchedule[unit.allocB.teacher_id][chosen.day][periodIdx] = slotB;

          classDaySubjectCount[unit.class_id][chosen.day][unit.allocA.subject_id] = 
            (classDaySubjectCount[unit.class_id][chosen.day][unit.allocA.subject_id] || 0) + 1;
          classDaySubjectCount[unit.class_id][chosen.day][unit.allocB.subject_id] = 
            (classDaySubjectCount[unit.class_id][chosen.day][unit.allocB.subject_id] || 0) + 1;

          for (const tId of [unit.allocA.teacher_id, unit.allocB.teacher_id]) {
            teacherDayPeriodCount[tId][chosen.day]++;
            teacherPeriodCount[tId][periodIdx] = (teacherPeriodCount[tId][periodIdx] || 0) + 1;
            if (periodIdx <= 4) {
              teacherBeforeBreakCount[tId] = (teacherBeforeBreakCount[tId] || 0) + 1;
              teacherDayBeforeBreakCount[tId][chosen.day] = (teacherDayBeforeBreakCount[tId][chosen.day] || 0) + 1;
            } else {
              teacherAfterBreakCount[tId] = (teacherAfterBreakCount[tId] || 0) + 1;
              teacherDayAfterBreakCount[tId][chosen.day] = (teacherDayAfterBreakCount[tId][chosen.day] || 0) + 1;
            }
          }
          teacherDaySubjectCount[unit.allocA.teacher_id][chosen.day][unit.allocA.subject_id] = 
            (teacherDaySubjectCount[unit.allocA.teacher_id][chosen.day][unit.allocA.subject_id] || 0) + 1;
          teacherDaySubjectCount[unit.allocB.teacher_id][chosen.day][unit.allocB.subject_id] = 
            (teacherDaySubjectCount[unit.allocB.teacher_id][chosen.day][unit.allocB.subject_id] || 0) + 1;

          classDayPeriodCount[unit.class_id][chosen.day] = (classDayPeriodCount[unit.class_id][chosen.day] || 0) + 1;
          if (periodIdx <= 4) {
            classBeforeBreakCount[unit.class_id] = (classBeforeBreakCount[unit.class_id] || 0) + 1;
          } else {
            classAfterBreakCount[unit.class_id] = (classAfterBreakCount[unit.class_id] || 0) + 1;
          }

          placedSlots.push(slotA, slotB);
        } else {
          const slot = {
            class_id: unit.class_id,
            subject_id: unit.alloc.subject_id,
            teacher_id: unit.alloc.teacher_id,
            day: chosen.day,
            period_index: periodIdx,
            is_locked: 0
          };

          classSchedule[unit.class_id][chosen.day][periodIdx] = [slot];
          teacherSchedule[unit.alloc.teacher_id][chosen.day][periodIdx] = slot;
          classDaySubjectCount[unit.class_id][chosen.day][unit.alloc.subject_id] = 
            (classDaySubjectCount[unit.class_id][chosen.day][unit.alloc.subject_id] || 0) + 1;

          teacherDayPeriodCount[unit.alloc.teacher_id][chosen.day]++;
          teacherDaySubjectCount[unit.alloc.teacher_id][chosen.day][unit.alloc.subject_id] = 
            (teacherDaySubjectCount[unit.alloc.teacher_id][chosen.day][unit.alloc.subject_id] || 0) + 1;
          teacherPeriodCount[unit.alloc.teacher_id][periodIdx] = 
            (teacherPeriodCount[unit.alloc.teacher_id][periodIdx] || 0) + 1;

          if (periodIdx <= 4) {
            teacherBeforeBreakCount[unit.alloc.teacher_id] = (teacherBeforeBreakCount[unit.alloc.teacher_id] || 0) + 1;
            teacherDayBeforeBreakCount[unit.alloc.teacher_id][chosen.day] = (teacherDayBeforeBreakCount[unit.alloc.teacher_id][chosen.day] || 0) + 1;
            classBeforeBreakCount[unit.class_id] = (classBeforeBreakCount[unit.class_id] || 0) + 1;
          } else {
            teacherAfterBreakCount[unit.alloc.teacher_id] = (teacherAfterBreakCount[unit.alloc.teacher_id] || 0) + 1;
            teacherDayAfterBreakCount[unit.alloc.teacher_id][chosen.day] = (teacherDayAfterBreakCount[unit.alloc.teacher_id][chosen.day] || 0) + 1;
            classAfterBreakCount[unit.class_id] = (classAfterBreakCount[unit.class_id] || 0) + 1;
          }

          classDayPeriodCount[unit.class_id][chosen.day] = (classDayPeriodCount[unit.class_id][chosen.day] || 0) + 1;
          placedSlots.push(slot);
        }
      }
    }

    if (unplaced.length === 0) {
      return {
        success: true,
        unplacedCount: 0,
        slots: placedSlots
      };
    }

    return {
      success: false,
      unplacedCount: unplaced.length,
      diagnostics: unplaced.map(u => ({
        type: 'WARNING',
        message: `Could not schedule unit ${u.unitId} without causing collisions.`
      })),
      slots: placedSlots
    };
  }
}
