/**
 * aSc-Inspired School Timetable Conflict-Free Generator Engine
 * Specially tuned for Northern Nigerian Secondary Schools.
 * Includes support for simultaneous paired elective subjects (e.g. Government ↔ Physics, Literature ↔ Chemistry).
 */

const PAIRED_SUBJECT_PAIRS = [
  ['GOV', 'PHY'],
  ['CHM', 'ECO'],
  ['BIO', 'LIT']
];


const HEAVY_SUBJECT_CODES = new Set(['PHY', 'CHM', 'BIO', 'MTH', 'GOV', 'LIT', 'ECO']);

function isHeavySubject(code, name) {
  const c = (code || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return HEAVY_SUBJECT_CODES.has(c) || 
         c === 'GOVT' || c === 'CHEM' || c === 'ECON' || c === 'MATHS' ||
         n.includes('MATH') || n.includes('PHYSIC') || n.includes('CHEM') || 
         n.includes('BIOL') || n.includes('GOVERN') || n.includes('LITERAT') || n.includes('ECON');
}

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
    let bestSuccessResult = null;
    let bestSuccessRestart = 0;

    for (let restart = 0; restart < this.maxRestarts; restart++) {
      const result = this._attemptSolve(
        classes,
        teachers,
        subjects,
        allocations,
        lockedSlots,
        restart > 0 // Add stochastic shuffling on restarts
      );

      if (!result.success && result.unplacedCount <= 16 && result.unplacedUnits) {
        const repaired = this._repairSchedule(result.slots, result.unplacedUnits, classes, teachers, subjects);
        if (repaired.success) {
          result.success = true;
          result.unplacedCount = 0;
          result.slots = repaired.slots;
        }
      }

      if (result.success) {
        // Run compaction pass to close any internal gaps and push empty periods to end of day
        this._compactSchedule(result.slots, classes, teachers, subjects);

        // Check for disjoint duplicates (same subject occurring in non-consecutive periods on same day)
        let hasDisjoint = false;
        for (const c of classes) {
          for (const d of this.days) {
            const daySlots = result.slots.filter(s => s.class_id === c.id && s.day === d);
            const subMap = {};
            for (const s of daySlots) {
              subMap[s.subject_id] = (subMap[s.subject_id] || []).concat(s.period_index);
            }
            for (const periods of Object.values(subMap)) {
              if (periods.length > 1) {
                periods.sort((a, b) => a - b);
                if (periods.length !== 2 || periods[1] !== periods[0] + 1) {
                  hasDisjoint = true;
                  break;
                }
              }
            }
            if (hasDisjoint) break;
          }
          if (hasDisjoint) break;
        }

        // Count internal gaps (empty periods before the last occupied period of the day)
        let gaps = 0;
        for (const c of classes) {
          const isJunior = c.name?.startsWith('JS') || c.level === 'JS';
          for (const d of this.days) {
            const cSlots = result.slots.filter(s => s.class_id === c.id && s.day === d);
            const pIndices = new Set(cSlots.map(s => s.period_index));
            const lastOccupied = Math.max(0, ...pIndices);
            const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
            for (let p = startP; p < lastOccupied; p++) {
              if (!pIndices.has(p)) gaps++;
            }
            // Friday: Junior expected 1 period (P2), Senior expected 5 periods (P2-P6)
            if (d === 'Friday') {
              const expectedCount = isJunior ? 1 : 5;
              if (cSlots.length < expectedCount) {
                gaps += (expectedCount - cSlots.length) * 2;
              }
            } else {
              // Mon-Thu: All periods must be filled
              const maxP = 8;
              for (let p = startP; p <= maxP; p++) {
                if (!pIndices.has(p)) gaps += 3;
              }
            }
          }
        }

        if (hasDisjoint) {
          gaps += 100;
        }

        result.gaps = gaps;

        // If zero gaps and NO disjoint duplicate subjects, this is a 100% perfect contiguous timetable!
        if (gaps === 0 && !hasDisjoint) {
          return {
            success: true,
            restarts: restart,
            diagnostics: [{ type: 'SUCCESS', message: '100% Conflict-free timetable generated successfully with 0 internal gaps and 0 duplicate subjects.' }],
            slots: result.slots
          };
        }

        if (!bestSuccessResult || gaps < bestSuccessResult.gaps) {
          bestSuccessResult = result;
          bestSuccessRestart = restart;
        }
      }

      if (result.unplacedCount < minConflicts) {
        minConflicts = result.unplacedCount;
        bestResult = result;
      }
    }

    // If any conflict-free solution was found, return the one with the fewest internal gaps
    if (bestSuccessResult) {
      this._compactSchedule(bestSuccessResult.slots, classes, teachers, subjects);
      return {
        success: true,
        restarts: bestSuccessRestart,
        diagnostics: [{ type: 'SUCCESS', message: `100% Conflict-free timetable generated with ${bestSuccessResult.gaps} minimal gaps.` }],
        slots: bestSuccessResult.slots
      };
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

  _compactSchedule(slots, classes, teachers, subjects) {
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

    let improved = true;
    let passes = 0;

    while (improved && passes < 15) {
      improved = false;
      passes++;

      for (const day of this.days) {
        for (const cls of classes) {
          const maxP = (day === 'Friday') ? this.fridayPeriods : this.regularPeriods;
          const startP = (day === 'Monday' || day === 'Friday') ? 2 : 1;

          for (let pEmpty = startP; pEmpty < maxP; pEmpty++) {
            const hasEmpty = !slots.some(s => s.class_id === cls.id && s.day === day && s.period_index === pEmpty);
            if (!hasEmpty) continue;

            // Find closest occupied period after pEmpty
            let nextP = -1;
            for (let p = pEmpty + 1; p <= maxP; p++) {
              if (slots.some(s => s.class_id === cls.id && s.day === day && s.period_index === p)) {
                nextP = p;
                break;
              }
            }
            if (nextP === -1) continue;

            const targetSlots = slots.filter(s => s.class_id === cls.id && s.day === day && s.period_index === nextP);

            let canMove = true;
            for (const s of targetSlots) {
              const teacherBusy = slots.some(other =>
                other !== s &&
                other.day === day &&
                other.period_index === pEmpty &&
                other.teacher_id === s.teacher_id
              );
              if (teacherBusy) {
                canMove = false;
                break;
              }

              const teacher = teacherMap[s.teacher_id];
              if (teacher?.time_preference === 'MORNING_ONLY' && pEmpty > 6) {
                canMove = false;
                break;
              }

              // BURNOUT PROTECTION: Prevent compaction from breaking teacher session interleaving
              // Don't move a slot if it would give the teacher 4+ periods in one session (morning or afternoon)
              const isShehu = teacher?.time_preference === 'MORNING_ONLY' || teacher?.name?.includes('Shehu');
              if (!isShehu) {
                const tDaySlots = slots.filter(other =>
                  other !== s &&
                  other.day === day &&
                  other.teacher_id === s.teacher_id
                );
                if (pEmpty <= 4) {
                  const morningCount = tDaySlots.filter(o => o.period_index <= 4).length;
                  if (morningCount >= 3) { canMove = false; break; }
                } else {
                  const afternoonCount = tDaySlots.filter(o => o.period_index > 4).length;
                  if (afternoonCount >= 3) { canMove = false; break; }
                }

                // Also prevent creating 4+ consecutive teaching periods in a session
                const sessionStart = (pEmpty <= 4) ? 1 : 5;
                const sessionEnd = (pEmpty <= 4) ? 4 : 8;
                const tSessionPeriods = new Set(
                  tDaySlots.filter(o => o.period_index >= sessionStart && o.period_index <= sessionEnd)
                    .map(o => o.period_index)
                );
                tSessionPeriods.add(pEmpty); // simulate adding the moved slot
                let maxRun = 0, run = 0;
                for (let pp = sessionStart; pp <= sessionEnd; pp++) {
                  if (tSessionPeriods.has(pp)) { run++; if (run > maxRun) maxRun = run; }
                  else run = 0;
                }
                if (maxRun >= 4) { canMove = false; break; }
              }

              const sub = subjectMap[s.subject_id];
              const code = (sub?.code || '').toUpperCase();
              if (code === 'MTH' && (pEmpty >= 7 || (day === 'Friday' && pEmpty >= 5))) {
                canMove = false;
                break;
              }
              if (code === 'ENG' && (pEmpty >= 8 || (day === 'Friday' && pEmpty >= 5))) {
                canMove = false;
                break;
              }
            }

            if (canMove) {
              for (const s of targetSlots) {
                s.period_index = pEmpty;
              }
              improved = true;
              break;
            }
          }
        }
      }
    }
  }

  _canPlaceSlot(unit, day, period, currentSlots, classMap, teacherMap, subjectMap) {
    const p2 = unit.duration === 2 ? period + 1 : null;
    const maxP = day === 'Friday' ? this.fridayPeriods : this.regularPeriods;
    if (period > maxP || (p2 && p2 > maxP)) return false;

    // Assembly rule: Period 1 on Mon & Fri
    if ((day === 'Monday' || day === 'Friday') && (period === 1 || p2 === 1)) return false;

    // Break span rule
    if (day !== 'Friday' && unit.duration === 2 && period === 4) return false;
    if (day === 'Friday' && unit.duration === 2) return false;

    // Friday class max
    const cls = classMap[unit.class_id];
    const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
    if (day === 'Friday') {
      if (isJunior && (period > 2 || (p2 && p2 > 2))) return false;
      if (period > 6 || (p2 && p2 > 6)) return false;
    }

    // Class occupancy
    const cBusy1 = currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === period);
    const cBusy2 = p2 ? currentSlots.some(s => s.class_id === unit.class_id && s.day === day && s.period_index === p2) : false;
    if (cBusy1 || cBusy2) return false;

    // Teachers
    const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
    for (const tId of tIds) {
      const t = teacherMap[tId];
      if (t?.unavailable_days && t.unavailable_days.includes(day)) return false;
      if (t?.time_preference === 'MORNING_ONLY' && (period > 6 || (p2 && p2 > 6))) return false;

      const tBusy1 = currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === period);
      const tBusy2 = p2 ? currentSlots.some(s => s.teacher_id === tId && s.day === day && s.period_index === p2) : false;
      if (tBusy1 || tBusy2) return false;

      // Hard Cap: No teacher ever teaches > 6 periods on Mon-Thu, or > 4 on Friday!
      const maxDaily = (day === 'Friday') ? 4 : 6;
      const daySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      if (daySlots.length + unit.duration > maxDaily) return false;

      // Daily max: 6 on Mon-Thu, 4 on Friday
      const tDaySlots = currentSlots.filter(s => s.teacher_id === tId && s.day === day);
      const maxDailyHard = (day === 'Friday') ? 4 : 6;
      if (tDaySlots.length + unit.duration > maxDailyHard) return false;

      // Session breather HARD constraint for M. Sumayya and M. Zainab Kabir only
      // (the two teachers with burnout complaints — guaranteed max 3 in any session)
      const isShehuCP = t?.time_preference === 'MORNING_ONLY' || t?.name?.includes('Shehu');
      const isBurnoutTarget = t?.name?.includes('Sumayya') || t?.name?.includes('Zainab');
      if (!isShehuCP && isBurnoutTarget) {
        if (period <= 4) {
          const mCount = tDaySlots.filter(s => s.period_index <= 4).length;
          if (mCount + unit.duration > 3) return false;
        }
        if ((p2 || period) > 4) {
          const aCount = tDaySlots.filter(s => s.period_index > 4).length;
          if (aCount + unit.duration > 3) return false;
        }
      }
    }

    // Subject restrictions
    const sIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
    for (const sId of sIds) {
      const sub = subjectMap[sId];
      const code = (sub?.code || '').toUpperCase();
      if (code === 'CHM' && (period === 8 || p2 === 8)) return false;
      if (code === 'MTH' && (period >= 7 || (p2 && p2 >= 7) || (day === 'Friday' && period >= 5))) return false;
      if (code === 'ENG' && (period >= 8 || (p2 && p2 >= 8) || (day === 'Friday' && period >= 5))) return false;
      
      // Class must never have the same subject twice on the same day
      if (currentSlots.some(s => s.class_id === unit.class_id && s.subject_id === sId && s.day === day)) {
        return false;
      }
    }

    return true;
  }

  _repairSchedule(slots, unplacedUnits, classes, teachers, subjects) {
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

    const currentSlots = [...slots];
    const unplaced = [...unplacedUnits];

    for (let uIdx = unplaced.length - 1; uIdx >= 0; uIdx--) {
      const unit = unplaced[uIdx];
      const cls = classMap[unit.class_id];
      const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
      let unitPlaced = false;

      const emptySlots = [];
      for (const d of this.days) {
        const maxP = d === 'Friday' ? (isJunior ? 2 : 6) : 8;
        const startP = (d === 'Monday' || d === 'Friday') ? 2 : 1;
        for (let p = startP; p <= maxP; p++) {
          if (!currentSlots.some(s => s.class_id === unit.class_id && s.day === d && s.period_index === p)) {
            emptySlots.push({ day: d, period: p });
          }
        }
      }

      // 1. Direct placement
      for (const e of emptySlots) {
        if (this._canPlaceSlot(unit, e.day, e.period, currentSlots, classMap, teacherMap, subjectMap)) {
          const alloc = unit.alloc || unit.allocA;
          currentSlots.push({
            class_id: unit.class_id,
            subject_id: alloc.subject_id,
            teacher_id: alloc.teacher_id,
            day: e.day,
            period_index: e.period,
            is_locked: 0
          });
          unitPlaced = true;
          unplaced.splice(uIdx, 1);
          break;
        }
      }
      if (unitPlaced) continue;

      // 2. 1-step swap
      for (const e of emptySlots) {
        const classSlots = currentSlots.filter(s => s.class_id === unit.class_id);
        for (const existing of classSlots) {
          const existingUnit = {
            class_id: existing.class_id,
            duration: 1,
            isPaired: false,
            alloc: {
              subject_id: existing.subject_id,
              teacher_id: existing.teacher_id,
              class_id: existing.class_id
            }
          };

          const withoutExisting = currentSlots.filter(s => s !== existing);
          if (this._canPlaceSlot(existingUnit, e.day, e.period, withoutExisting, classMap, teacherMap, subjectMap)) {
            const withExistingAtE = [...withoutExisting, {
              ...existing,
              day: e.day,
              period_index: e.period
            }];

            if (this._canPlaceSlot(unit, existing.day, existing.period_index, withExistingAtE, classMap, teacherMap, subjectMap)) {
              const oldDay = existing.day;
              const oldPeriod = existing.period_index;
              existing.day = e.day;
              existing.period_index = e.period;
              const alloc = unit.alloc || unit.allocA;
              currentSlots.push({
                class_id: unit.class_id,
                subject_id: alloc.subject_id,
                teacher_id: alloc.teacher_id,
                day: oldDay,
                period_index: oldPeriod,
                is_locked: 0
              });
              unitPlaced = true;
              unplaced.splice(uIdx, 1);
              break;
            }
          }
        }
        if (unitPlaced) break;
      }
    }

    return {
      success: unplaced.length === 0,
      unplacedCount: unplaced.length,
      slots: currentSlots
    };
  }

  _attemptSolve(classes, teachers, subjects, allocations, lockedSlots, stochastic = false) {
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

    const classSchedule = {};
    const teacherSchedule = {};
    const teacherDayPeriodCount = {};
    const teacherPeriodCount = {};
    const classDaySubjectCount = {};
    const classDayPeriodCount = {};
    const classDayHeavyCount = {};
    const teacherBeforeBreakCount = {};
    const teacherAfterBreakCount = {};
    const classBeforeBreakCount = {};
    const classAfterBreakCount = {};

    for (const c of classes) {
      classSchedule[c.id] = {};
      classDaySubjectCount[c.id] = {};
      classDayPeriodCount[c.id] = {};
      classDayHeavyCount[c.id] = {};
      classBeforeBreakCount[c.id] = 0;
      classAfterBreakCount[c.id] = 0;
      for (const d of this.days) {
        classSchedule[c.id][d] = {};
        classDaySubjectCount[c.id][d] = {};
        classDayPeriodCount[c.id][d] = 0;
        classDayHeavyCount[c.id][d] = 0;
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
      const sub = subjectMap[lock.subject_id];
      if (isHeavySubject(sub?.code, sub?.name)) {
        classDayHeavyCount[lock.class_id][lock.day] = (classDayHeavyCount[lock.class_id][lock.day] || 0) + 1;
      }

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

    // Compute total weekly load for each teacher
    const teacherWeeklyLoads = {};
    for (const a of allocations) {
      teacherWeeklyLoads[a.teacher_id] = (teacherWeeklyLoads[a.teacher_id] || 0) + a.periods_per_week;
    }

    // Sort lesson units by MRV (Most Constrained Variable first):
    // 1. Teachers with MORNING_ONLY or Friday absent (M. Shehu, M. Zainab Kabir)
    // 2. Paired simultaneous electives
    // 3. Double periods (duration = 2)
    // 4. Heavy teacher workload
    // 5. Core cognitive subjects (Math, English, Chem)
    lessonUnits.sort((a, b) => {
      const getPriority = (unit) => {
        let p = 0;
        const tIds = unit.isPaired ? [unit.allocA.teacher_id, unit.allocB.teacher_id] : [unit.alloc.teacher_id];
        for (const tId of tIds) {
          const t = teacherMap[tId];
          if (t?.time_preference === 'MORNING_ONLY') p += 4000;
          if (t?.unavailable_days && t.unavailable_days.includes('Friday')) p += 3000;
          p += (teacherWeeklyLoads[tId] || 0) * 40;
        }
        if (unit.isPaired) p += 2500;
        if (unit.duration === 2) p += 1500;
        const subIds = unit.isPaired ? [unit.allocA.subject_id, unit.allocB.subject_id] : [unit.alloc.subject_id];
        for (const sId of subIds) {
          const code = (subjectMap[sId]?.code || '').toUpperCase();
          if (code === 'MTH') p += 800;
          if (code === 'ENG') p += 600;
          if (code === 'CHM') p += 500;
        }
        return p;
      };

      const pA = getPriority(a) + (stochastic ? (Math.random() * 400 - 200) : 0);
      const pB = getPriority(b) + (stochastic ? (Math.random() * 400 - 200) : 0);
      return pB - pA;
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

            // MORNING_ONLY Hard Constraint: M. Shehu must NEVER teach in Period 7 or 8!
            // With Friday 100% free, he teaches up to Period 6 on Mon-Thu (dismissed by 12:30 PM).
            const teacher = teacherMap[tId];
            if (teacher && (teacher.time_preference === 'MORNING_ONLY' || teacher.name?.includes('Shehu'))) {
              if (p > 6 || (p2 && p2 > 6)) {
                allTeachersFree = false;
                break;
              }
            }
          }
          if (!allTeachersFree) continue;

          // 2b. Monday and Friday Period 1 Assembly Policy:
          // Period 1 (8:00 - 8:40 AM) on Monday and Friday is strictly reserved for Assembly across ALL classes!
          // No academic classes can be scheduled during Period 1 on Monday and Friday.
          if ((day === 'Monday' || day === 'Friday') && (p === 1 || (p2 && p2 === 1))) {
            continue;
          }

          // 3. Double period rule: NEVER span across break (Break is between Period 4 and Period 5 on Mon-Thu)
          if (day !== 'Friday' && unit.duration === 2 && p === 4) continue;

          // 4. Friday Double Period Rule: Never place double periods on Friday (condensed morning; keep all doubles Mon-Thu)
          if (day === 'Friday' && unit.duration === 2) continue;

          // 5. Friday Scheduling & Dismissal Policy:
          // Junior classes (JS 1-3) dismiss at Period 4 (10:40 AM) before break (P2-P4 = 3 periods + 31 Mon-Thu = 34 periods total).
          // Senior classes (SS 1-3) dismiss at Period 6 (12:00 PM before Juma'at; P2-P6 = 5 periods + 31 Mon-Thu = 36 periods total).
          // Strictly ZERO classes after Period 6 on Friday across the entire school!
          if (day === 'Friday' && (p > 6 || (p2 && p2 > 6))) {
            continue;
          }

          const cls = classes.find(c => c.id === unit.class_id);
          const isJuniorClass = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');
          if (isJuniorClass && day === 'Friday' && (p > 2 || (p2 && p2 > 2))) {
            continue;
          }

          // Calculate soft score heuristic
          let penalty = 0;

          // Identify specific paired elective combinations
          let isGovPhy = false;
          let isChmEco = false;
          let isBioLit = false;
          if (unit.isPaired) {
            for (const sId of unitSubjects) {
              const code = (subjectMap[sId]?.code || subjectMap[sId]?.name || '').toUpperCase();
              if (code === 'GOV' || code === 'GOVT' || code === 'PHY') isGovPhy = true;
              if (code === 'CHM' || code === 'CHEM' || code === 'ECO' || code === 'ECON') isChmEco = true;
              if (code === 'BIO' || code === 'BIOL' || code === 'LIT') isBioLit = true;
            }
          }

          // Rule A: Government ↔ Physics (Heavy with Heavy):
          // Must be in morning / up to period 6 (P1–P6) with M. Shehu
          if (isGovPhy && (p > 6 || (p2 && p2 > 6))) {
            continue; // M. Shehu cannot teach in tired afternoon hours (P7/P8)
          }

          // Rule B: Chemistry ↔ Economics (Less Heavy with Less Heavy):
          // Chemistry is a science subject: NEVER schedule in the last period (Period 8 on Mon-Thu)!
          // Strongly prefer immediately after break (Period 5 & Period 6) or morning.
          if (isChmEco) {
            if (p === 8 || (p2 && p2 === 8)) {
              continue; // Strictly NEVER schedule Chemistry in the last period of the day!
            }
            if (p === 7 || (p2 && p2 === 7)) {
              penalty += 9000; // Heavily avoid Period 7 (tired hour)
            }
            if (p === 5 || p === 6 || p2 === 6) {
              penalty -= 300; // High reward for prime post-break periods P5 & P6
            }
            if (day === 'Friday') {
              penalty += 1200; // Strongly avoid placing paired electives on Friday
            }
          }

          // Rule C: Biology ↔ Literature (Less Heavy with Less Heavy):
          // Balanced distribution before/after break, avoid Period 8.
          if (isBioLit) {
            if (p === 8 || (p2 && p2 === 8)) {
              penalty += 3000; // Avoid last period
            }
            if (day === 'Friday') {
              penalty += 1200; // Strongly avoid placing paired electives on Friday
            }
          }

          const isChemistry = unitSubjects.some(sId => {
            const sub = subjectMap[sId];
            const code = (sub?.code || '').toUpperCase();
            return code === 'CHM' || code === 'CHEM';
          });
          if (isChemistry) {
            if (p === 8 || (p2 && p2 === 8)) continue;
            if (p === 7 || (p2 && p2 === 7)) penalty += 9000;
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

          // Rule D: English Language Placement Rules:
          // Core cognitive subject: "the rule for english is somehow close to math dont assign the period in tired hours"
          // Avoid tired hours: strictly never assign in the last period (Period 8 on Mon-Thu, Period 6 on Friday)
          // Heavily avoid 2nd to last period (Period 7 on Mon-Thu, Period 5 on Friday)
          // Prioritize fresh morning periods (P1–P4) and immediately after break (P5).
          const isEnglish = !unit.isPaired && unitSubjects.some(sId => {
            const sub = subjectMap[sId];
            const code = (sub?.code || '').toUpperCase();
            const name = (sub?.name || '').toUpperCase();
            return code === 'ENG' || name.includes('ENG') || name.includes('ENGLISH');
          });

          if (isEnglish) {
            // Strict Hard Constraint: Never in tired hours
            // - On Monday-Thursday: Never Period 8 (last period)
            // - On Friday: Never Period 5 or Period 6 (after-break / closing periods)
            if (p >= 8 || (p2 && p2 >= 8)) {
              continue;
            }
            if (day === 'Friday' && (p >= 5 || (p2 && p2 >= 5))) {
              continue;
            }

            // Strong Penalty for Period 7 on Mon-Thu (2nd to last tired hour)
            if (p === 7 || (p2 && p2 === 7)) {
              penalty += 700;
            }

            // Reward fresh morning periods (P1–P4) and early post-break (P5)
            if (p === 1 || p === 2 || p === 5 || p2 === 2) {
              penalty -= 180;
            } else if (p === 3 || p === 4) {
              penalty -= 100;
            } else if (p === 6) {
              penalty += 150; // Moderate penalty for late afternoon P6
            }
          }

          // 5. Light Friday Rule for Heavy Science / Art Subjects:
          // User requirement: "avoid too much load for heavy sciene / airt subject on friday just make them appear little"
          // Heavy subjects (PHY, CHM, BIO, MTH, GOV, LIT, ECO):
          // - Limit to at most 1 (max 2) periods in any class on Friday
          // - Strongly favor Monday-Thursday so heavy subjects only appear in minimal numbers on Friday
          const isHeavyUnit = unit.isPaired || unitSubjects.some(sId => {
            const sub = subjectMap[sId];
            return isHeavySubject(sub?.code, sub?.name);
          });

          if (day === 'Friday' && isHeavyUnit) {
            const maxHeavyFri = isJuniorClass ? 1 : 2;
            const heavyOnFriday = classDayHeavyCount[unit.class_id]?.['Friday'] || 0;
            if (heavyOnFriday >= maxHeavyFri) {
              // Strictly at most 1 in Junior and 2 in Senior on Friday
              continue;
            }
            // Heavy subjects strongly avoid Friday
            penalty += 2000;
          }

          if (day === 'Friday' && unit.isPaired) {
            let maxCurrentCount = 0;
            for (let i = 0; i < unitTeachers.length; i++) {
              const tId = unitTeachers[i];
              const sId = unitSubjects[i];
              const cnt = teacherDaySubjectCount[tId]?.[day]?.[sId] || 0;
              if (cnt > maxCurrentCount) maxCurrentCount = cnt;
            }
            if (maxCurrentCount >= 1) {
              // Disallow 2 or more periods of Chemistry (or Literature / Physics / Bio) on Friday!
              continue;
            }
            penalty += 200;
          }

          for (const tId of unitTeachers) {
            const teacher = teacherMap[tId];
            if (teacher && (teacher.time_preference === 'MORNING_ONLY' || teacher.name?.includes('Shehu'))) {
              if (p === 6 || p2 === 6) {
                penalty += 120; // allow period 6 when needed (to fit 22 periods into 4 days), but prefer 1-5
              } else if (p === 5 || p2 === 5) {
                penalty += 30; // prefer 1-4
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

            // Teacher daily workload balancing
            const teacherDaily = teacherDayPeriodCount[tId][day] || 0;
            const maxDaily = (day === 'Friday') ? Math.min(teacher?.max_daily_periods || 5, 4) : Math.max(teacher?.max_daily_periods || 5, 6);
            penalty += teacherDaily * 40;
            if (teacherDaily + unit.duration > maxDaily) {
              penalty += 1500 * (teacherDaily + unit.duration - maxDaily);
            }

            // =========================================================================
            // MANDATORY BREAK INTERLEAVING & BURNOUT PREVENTION
            // =========================================================================
            const tObj = teacherMap[tId];
            const isShehu = tObj?.time_preference === 'MORNING_ONLY' || tObj?.name?.includes('Shehu');
            const isBurnoutTarget = tObj?.name?.includes('Sumayya') || tObj?.name?.includes('Zainab');
            let unavDaysArr = [];
            try {
              unavDaysArr = tObj?.unavailable_days ? (typeof tObj.unavailable_days === 'string' ? JSON.parse(tObj.unavailable_days) : tObj.unavailable_days) : [];
            } catch { unavDaysArr = []; }
            const isFourDayTeacher = Array.isArray(unavDaysArr) && unavDaysArr.includes('Friday');

            // 1. Daily Workload Caps
            if (isFourDayTeacher) {
              // 4-day staff (M. Shehu, M. Zainab Kabir): strictly max 6 periods/day
              if (teacherDaily + unit.duration > 6) continue;
            } else {
              // 5-day staff: Friday max 4 (Juma'at)
              if (day === 'Friday' && teacherDaily + unit.duration > 4) continue;
              // For M. Sumayya: HARD CAP of 5 periods/day on Mon-Thu!
              if (tObj?.name?.includes('Sumayya')) {
                if (day !== 'Friday' && teacherDaily + unit.duration > 5) continue;
              } else {
                if (teacherDaily + unit.duration > 6) continue;
                if (teacherDaily + unit.duration > 5) {
                  penalty += 3500 * (teacherDaily + unit.duration - 5);
                }
              }
            }

            // 2. Session Breathers & Consecutive Blocks
            const dayBefore = teacherDayBeforeBreakCount[tId]?.[day] || 0;
            const dayAfter = teacherDayAfterBreakCount[tId]?.[day] || 0;

            if (isBurnoutTarget) {
              // HARD CONSTRAINTS FOR M. SUMAYYA AND M. ZAINAB KABIR:
              // Strictly guaranteed at least one 40-min free period in morning and afternoon!
              if (p <= 4 && dayBefore + unit.duration > 3) continue;
              if (p > 4 && dayAfter + unit.duration > 3) continue;

              // Strictly max 3 consecutive periods (prefer <= 2)
              let consecBefore = 0;
              const startCheck = (p <= 4) ? 1 : 5;
              for (let cp = p - 1; cp >= startCheck; cp--) {
                if (teacherSchedule[tId][day][cp]) consecBefore++;
                else break;
              }
              let consecAfter = 0;
              const endCheck = (p <= 4) ? 4 : maxP;
              for (let cp = (p2 || p) + 1; cp <= endCheck; cp++) {
                if (teacherSchedule[tId][day][cp]) consecAfter++;
                else break;
              }
              const sessionConsec = consecBefore + unit.duration + consecAfter;
              if (sessionConsec > 3) continue; // NEVER more than 3 consecutive periods!
              if (sessionConsec === 3) penalty += 2000; // Strongly prefer 1-2 periods then breather
            } else if (!isShehu) {
              // SOFT HEURISTICS FOR ALL OTHER TEACHERS:
              // Strongly encourage breathers without blocking solver feasibility
              if (p <= 4 && dayBefore + unit.duration > 3) penalty += 2500;
              if (p > 4 && dayAfter + unit.duration > 3) penalty += 2500;

              let consecBefore = 0;
              const startCheck = (p <= 4) ? 1 : 5;
              for (let cp = p - 1; cp >= startCheck; cp--) {
                if (teacherSchedule[tId][day][cp]) consecBefore++;
                else break;
              }
              let consecAfter = 0;
              const endCheck = (p <= 4) ? 4 : maxP;
              for (let cp = (p2 || p) + 1; cp <= endCheck; cp++) {
                if (teacherSchedule[tId][day][cp]) consecAfter++;
                else break;
              }
              const sessionConsec = consecBefore + unit.duration + consecAfter;
              if (sessionConsec >= 4) penalty += 4000;
              else if (sessionConsec === 3) penalty += 800;
            }
          }

          // Avoid clustering same subject on same day in class:
          // A class can NEVER have more than 1 session of the same subject in a single day
          // (Double periods are already a single unit with duration=2)
          let subjectClash = false;
          for (const sId of unitSubjects) {
            const exCount = classDaySubjectCount[unit.class_id][day][sId] || 0;
            if (exCount > 0) {
              subjectClash = true;
              break;
            }
          }
          if (subjectClash) continue;

          // Class daily load balancing & even distribution across the week
          const targetClass = classMap[unit.class_id];
          const isJunior = targetClass && (targetClass.level === 'JS' || (targetClass.name && targetClass.name.startsWith('JS')));
          const classDaily = classDayPeriodCount[unit.class_id]?.[day] || 0;
          if (day !== 'Friday') {
            const maxDay = (day === 'Monday') ? 7 : 8;
            if (classDaily + unit.duration > maxDay) {
              continue;
            } else if (classDaily < maxDay) {
              penalty -= 400;
            }
          } else {
            // Friday: Junior targets exactly 1 period (P2), Senior targets exactly 5 periods (P2-P6)
            const maxFri = isJunior ? 1 : 5;
            if (classDaily + unit.duration > maxFri) {
              continue; // Strictly disallow exceeding allowed Friday periods
            } else if (classDaily < maxFri) {
              penalty -= 6000;
            }
          }

          // Schedule Compactness & Zero Early Gaps Rule:
          // User requirement: "we dont want free periods in early time especially before break and after after take empty classes to last period"
          const startPeriod = (day === 'Monday' || day === 'Friday') ? 2 : 1;

          // 1. Reward opening bell (Period startPeriod)
          if (p === startPeriod) {
            penalty -= 300;
          } else if (!classSchedule[unit.class_id][day][startPeriod]) {
            // Very heavy penalty for scheduling later periods when opening period is still empty!
            penalty += 8000;
          }

          // Strict Hard Constraint: NEVER create an internal hole/gap in the student's day!
          // If (p - 1) is empty and there is at least one occupied period earlier in the day, placing at p is FORBIDDEN!
          if (p > startPeriod && !classSchedule[unit.class_id][day][p - 1]) {
            let hasOccupiedEarlier = false;
            for (let k = startPeriod; k < p - 1; k++) {
              if (classSchedule[unit.class_id][day][k]) {
                hasOccupiedEarlier = true;
                break;
              }
            }
            if (hasOccupiedEarlier) {
              penalty += 80000; // Heavily penalize internal gaps between lessons!
            }
          }

          // On Friday: strictly start at startPeriod and be contiguous
          if (day === 'Friday' && p > startPeriod && !classSchedule[unit.class_id][day][p - 1]) {
            penalty += 80000;
          }

          // 2. Before Break Contiguity (startPeriod to 4):
          if (p <= 4) {
            let morningGaps = 0;
            for (let prevP = startPeriod; prevP < p; prevP++) {
              if (!classSchedule[unit.class_id][day][prevP]) {
                morningGaps++;
              }
            }
            if (morningGaps > 0) {
              penalty += morningGaps * 7000; // Strictly avoid free periods before break!
            }
          }

          // 3. After Break Contiguity (P5–P8 on Mon-Thu):
          // Before placing in the afternoon (P5–P8), the morning (startPeriod to 4) MUST be filled first!
          if (p >= 5) {
            let morningUnfilled = 0;
            for (let m = startPeriod; m <= 4; m++) {
              if (!classSchedule[unit.class_id][day][m]) {
                morningUnfilled++;
              }
            }
            if (morningUnfilled > 0) {
              penalty += morningUnfilled * 9000; // Never put classes after break if morning is empty!
            }

            // In the afternoon, must also be contiguous starting from Period 5 downwards
            let afternoonGaps = 0;
            for (let prevP = 5; prevP < p; prevP++) {
              if (!classSchedule[unit.class_id][day][prevP]) {
                afternoonGaps++;
              }
            }
            if (afternoonGaps > 0) {
              penalty += afternoonGaps * 6000; // Push all empty classes to the very last period(s)!
            }
          }

          // Reward contiguous consecutive periods
          if (p > 1 && classSchedule[unit.class_id][day][p - 1]) {
            penalty -= 300;
          }

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
          classDayHeavyCount[unit.class_id][chosen.day] = (classDayHeavyCount[unit.class_id][chosen.day] || 0) + 1;
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
          const sub = subjectMap[unit.alloc.subject_id];
          if (isHeavySubject(sub?.code, sub?.name)) {
            classDayHeavyCount[unit.class_id][chosen.day] = (classDayHeavyCount[unit.class_id][chosen.day] || 0) + 1;
          }
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
      unplacedUnits: unplaced,
      diagnostics: unplaced.map(u => ({
        type: 'WARNING',
        message: `Could not schedule unit ${u.unitId} without causing collisions.`
      })),
      slots: placedSlots
    };
  }
}
