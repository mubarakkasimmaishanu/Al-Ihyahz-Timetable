/**
 * Timetable Conflict Validator & Diagnostic Reporter
 */

export function validateTimetable(slots, classes, teachers, subjects, allocations, options = {}) {
  const fridayPeriods = options.fridayPeriods || 4;
  const regularPeriods = options.regularPeriods || 8;

  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  const conflicts = [];
  const warnings = [];

  // Indexing structures
  // teacherOccupancy[teacherId][day][period] = [slots]
  // classOccupancy[classId][day][period] = [slots]
  const teacherOccupancy = {};
  const classOccupancy = {};
  const teacherDailyPeriods = {};

  for (const slot of slots) {
    const { teacher_id, class_id, subject_id, day, period_index } = slot;
    const cls = classMap[class_id];
    const isJunior = cls && (cls.name?.startsWith('JS') || cls.level === 'JS');

    // Check Monday and Friday Period 1 Assembly reservation
    if ((day === 'Monday' || day === 'Friday') && period_index === 1) {
      conflicts.push({
        type: 'ASSEMBLY_VIOLATION',
        severity: 'CRITICAL',
        message: `CLASH: Class "${cls?.name || class_id}" has a subject scheduled on ${day} Period 1, which is reserved for school assembly!`
      });
    }

    // Check Friday period bounds
    if (day === 'Friday') {
      const maxAllowedFri = isJunior ? 4 : fridayPeriods;
      if (period_index > maxAllowedFri) {
        conflicts.push({
          type: 'FRIDAY_OVERFLOW',
          severity: 'CRITICAL',
          message: `Period ${period_index} is scheduled on Friday for class "${cls?.name || class_id}", but Friday closes after period ${maxAllowedFri} for Juma'at prayer.`
        });
      }
    }

    // 1. Teacher occupancy check
    if (!teacherOccupancy[teacher_id]) teacherOccupancy[teacher_id] = {};
    if (!teacherOccupancy[teacher_id][day]) teacherOccupancy[teacher_id][day] = {};
    if (!teacherOccupancy[teacher_id][day][period_index]) teacherOccupancy[teacher_id][day][period_index] = [];
    teacherOccupancy[teacher_id][day][period_index].push(slot);

    // 2. Class occupancy check
    if (!classOccupancy[class_id]) classOccupancy[class_id] = {};
    if (!classOccupancy[class_id][day]) classOccupancy[class_id][day] = {};
    if (!classOccupancy[class_id][day][period_index]) classOccupancy[class_id][day][period_index] = [];
    classOccupancy[class_id][day][period_index].push(slot);

    // 3. Teacher daily workload accumulation
    if (!teacherDailyPeriods[teacher_id]) teacherDailyPeriods[teacher_id] = {};
    teacherDailyPeriods[teacher_id][day] = (teacherDailyPeriods[teacher_id][day] || 0) + 1;
  }

  // Detect Teacher Clashes (Double booking)
  for (const [teacherId, days] of Object.entries(teacherOccupancy)) {
    const teacherName = teacherMap[teacherId]?.name || `Teacher #${teacherId}`;
    for (const [day, periods] of Object.entries(days)) {
      for (const [period, slotList] of Object.entries(periods)) {
        if (slotList.length > 1) {
          const conflictingClasses = slotList.map(s => classMap[s.class_id]?.name || s.class_id).join(', ');
          conflicts.push({
            type: 'TEACHER_CLASH',
            severity: 'CRITICAL',
            teacher_id: Number(teacherId),
            day,
            period: Number(period),
            message: `CLASH: ${teacherName} is double-booked on ${day}, Period ${period} in classes: ${conflictingClasses}.`
          });
        }
      }
    }
  }

  // Helper to check if two subjects are recognized parallel electives (Senior Secondary splits)
  const isRecognizedElectivePair = (sId1, sId2) => {
    const code1 = (subjectMap[sId1]?.code || subjectMap[sId1]?.name || '').toUpperCase();
    const code2 = (subjectMap[sId2]?.code || subjectMap[sId2]?.name || '').toUpperCase();
    const isGovPhy = (code1 === 'GOV' && code2 === 'PHY') || (code1 === 'PHY' && code2 === 'GOV');
    const isChmEco = ((code1 === 'CHM' || code1 === 'CHEM') && (code2 === 'ECO' || code2 === 'ECON')) || 
                     ((code1 === 'ECO' || code1 === 'ECON') && (code2 === 'CHM' || code2 === 'CHEM'));
    const isBioLit = ((code1 === 'BIO' || code1 === 'BIOL') && code2 === 'LIT') || 
                     (code1 === 'LIT' && (code2 === 'BIO' || code2 === 'BIOL'));
    // Legacy support
    const isLitChm = (code1 === 'LIT' && (code2 === 'CHM' || code2 === 'CHEM')) || 
                     ((code1 === 'CHM' || code1 === 'CHEM') && code2 === 'LIT');
    const isEcoBio = ((code1 === 'ECO' || code1 === 'ECON') && (code2 === 'BIO' || code2 === 'BIOL')) || 
                     ((code1 === 'BIO' || code1 === 'BIOL') && (code2 === 'ECO' || code2 === 'ECON'));
    return isGovPhy || isChmEco || isBioLit || isLitChm || isEcoBio;
  };

  // Detect Class Clashes (Two subjects at same time in one class)
  for (const [classId, days] of Object.entries(classOccupancy)) {
    const className = classMap[classId]?.name || `Class #${classId}`;
    for (const [day, periods] of Object.entries(days)) {
      for (const [period, slotList] of Object.entries(periods)) {
        if (slotList.length > 1) {
          // If exactly 2 subjects and they are an approved parallel elective pair, allow simultaneous scheduling!
          if (slotList.length === 2 && isRecognizedElectivePair(slotList[0].subject_id, slotList[1].subject_id)) {
            continue;
          }

          const conflictingSubjects = slotList.map(s => subjectMap[s.subject_id]?.name || s.subject_id).join(' AND ');
          conflicts.push({
            type: 'CLASS_CLASH',
            severity: 'CRITICAL',
            class_id: Number(classId),
            day,
            period: Number(period),
            message: `CLASH: ${className} has multiple subjects scheduled simultaneously on ${day}, Period ${period}: ${conflictingSubjects}.`
          });
        }
      }
    }
  }

  // Check allocation fulfillment (Did every allocation get its required weekly periods?)
  for (const alloc of allocations) {
    const actualSlots = slots.filter(
      s => s.class_id === alloc.class_id && s.subject_id === alloc.subject_id
    );

    if (actualSlots.length < alloc.periods_per_week) {
      const clsName = classMap[alloc.class_id]?.name || alloc.class_id;
      const subName = subjectMap[alloc.subject_id]?.name || alloc.subject_id;
      warnings.push({
        type: 'UNDER_ALLOCATED',
        severity: 'MEDIUM',
        message: `${clsName} - ${subName}: Scheduled ${actualSlots.length} of ${alloc.periods_per_week} required weekly periods.`
      });
    }
  }

  // Detect Pedagogical Rule Violations: Mathematics scheduled in 2nd to last or last period
  for (const slot of slots) {
    const sub = subjectMap[slot.subject_id];
    const isMath = sub && ((sub.code || '').toUpperCase() === 'MTH' || (sub.name || '').toUpperCase().includes('MATH'));
    if (isMath) {
      const isLateMonThu = slot.day !== 'Friday' && slot.period_index >= 7;
      const isLateFriday = slot.day === 'Friday' && slot.period_index >= 5;
      if (isLateMonThu || isLateFriday) {
        warnings.push({
          type: 'LATE_MATH_PLACEMENT',
          severity: 'HIGH',
          message: `Pedagogical Rule Violation: Mathematics is scheduled on ${slot.day}, Period ${slot.period_index} for ${classMap[slot.class_id]?.name || slot.class_id}. Math should never be scheduled in the 2nd to last or last period of the day.`
        });
      }
    }
  }

  // Detect Pedagogical Rule Violations: English Language scheduled in tired closing periods (Period 8 Mon-Thu, Period 5/6 Friday)
  for (const slot of slots) {
    const sub = subjectMap[slot.subject_id];
    const isEng = sub && ((sub.code || '').toUpperCase() === 'ENG' || (sub.name || '').toUpperCase().includes('ENG'));
    if (isEng) {
      const isLastPeriodMonThu = slot.day !== 'Friday' && slot.period_index >= 8;
      const isLateFriday = slot.day === 'Friday' && slot.period_index >= 5;
      if (isLastPeriodMonThu || isLateFriday) {
        warnings.push({
          type: 'TIRED_HOURS_ENGLISH_PLACEMENT',
          severity: 'HIGH',
          message: `Pedagogical Warning: English Language is scheduled on ${slot.day}, Period ${slot.period_index} for ${classMap[slot.class_id]?.name || slot.class_id}. Core language studies should not be assigned during tired closing periods.`
        });
      }
    }
  }

  // Detect Teacher Unavailable Day Violations (e.g. absent on Friday)
  for (const slot of slots) {
    const teacher = teacherMap[slot.teacher_id];
    if (teacher?.unavailable_days) {
      let unavDays = [];
      try {
        unavDays = typeof teacher.unavailable_days === 'string'
          ? JSON.parse(teacher.unavailable_days)
          : teacher.unavailable_days;
      } catch {
        unavDays = teacher.unavailable_days.split(',').map(s => s.trim());
      }
      if (Array.isArray(unavDays) && unavDays.includes(slot.day)) {
        conflicts.push({
          type: 'TEACHER_UNAVAILABLE_DAY',
          severity: 'CRITICAL',
          teacher_id: slot.teacher_id,
          day: slot.day,
          period: slot.period_index,
          message: `RESTRICTION VIOLATION: ${teacher.name} is scheduled on ${slot.day}, Period ${slot.period_index}, but is marked as unavailable/absent on ${slot.day}.`
        });
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflictCount: conflicts.length,
    warningCount: warnings.length,
    conflicts,
    warnings,
    summary: conflicts.length === 0
      ? 'Perfect: 0 collisions detected across all teachers and classes.'
      : `Found ${conflicts.length} critical clash(es).`
  };
}
