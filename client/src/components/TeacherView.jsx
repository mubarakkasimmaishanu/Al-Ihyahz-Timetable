import React, { useState, useEffect, useMemo } from 'react';

export default function TeacherView({ teachers, classes = [], allocations = [], slots, settings }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Auto-select Malam Shehu (or first teacher) on load
  useEffect(() => {
    if (teachers && teachers.length > 0) {
      const exists = teachers.some(t => String(t.id) === String(selectedTeacherId));
      if (!selectedTeacherId || !exists) {
        const shehu = teachers.find(t => 
          t.name.toLowerCase().includes('shehu') || 
          t.name.toLowerCase().includes('malan') || 
          t.code === 'MSH'
        );
        setSelectedTeacherId(shehu ? shehu.id : teachers[0].id);
      }
    }
  }, [teachers, selectedTeacherId]);

  const currentTeacher = useMemo(() => {
    return teachers.find(t => String(t.id) === String(selectedTeacherId)) || teachers[0];
  }, [teachers, selectedTeacherId]);

  const teacherSlots = useMemo(() => {
    if (!currentTeacher) return [];
    return slots.filter(s => String(s.teacher_id) === String(currentTeacher.id));
  }, [slots, currentTeacher]);

  const classMap = useMemo(() => {
    return Object.fromEntries((classes || []).map(c => [c.id, c.name]));
  }, [classes]);

  // Find all classes taught by this teacher
  const teacherClasses = useMemo(() => {
    if (!currentTeacher) return [];
    const classIdSet = new Set();
    (allocations || [])
      .filter(a => String(a.teacher_id) === String(currentTeacher.id))
      .forEach(a => classIdSet.add(a.class_id));
    teacherSlots.forEach(s => classIdSet.add(s.class_id));

    return (classes || [])
      .filter(c => classIdSet.has(c.id))
      .map(c => c.name);
  }, [currentTeacher, allocations, teacherSlots, classes]);

  // Slot lookup: slotMap[day][period] = slot
  const slotMap = useMemo(() => {
    const map = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
    for (const s of teacherSlots) {
      if (!map[s.day]) map[s.day] = {};
      map[s.day][s.period_index] = s;
    }
    return map;
  }, [teacherSlots]);

  // Short day names
  const days = [
    { full: 'Monday', short: 'Mon' },
    { full: 'Tuesday', short: 'Tue' },
    { full: 'Wednesday', short: 'Wed' },
    { full: 'Thursday', short: 'Thu' },
    { full: 'Friday', short: 'Fri' }
  ];

  const schoolTitle = settings.school_name || 'AL-IHYAZ ACADEMY';
  const sessionText = settings.academic_session || '2025/26 TIME TABLE';

  if (!currentTeacher) {
    return <div style={{ padding: '16px' }}>Loading teachers...</div>;
  }

  // Shorten long subject names
  const toShortSubject = (name, code) => {
    if (!name && !code) return '';
    const val = (name || code).trim().toUpperCase();
    const map = {
      'MATHEMATICS': 'MATHS',
      'PHYSICS': 'PHY',
      'ENGLISH': 'ENG',
      'ENGLISH LANGUAGE': 'ENG',
      'BASIC SCIENCE': 'B.SCI',
      'BASIC TECH': 'B.TECH',
      'BASIC TECHNOLOGY': 'B.TECH',
      'AGRICULTURAL SCIENCE': 'AGRIC',
      'AGRIC': 'AGRIC',
      'BIOLOGY': 'BIO',
      'CHEMISTRY': 'CHEM',
      'ECONOMICS': 'ECON',
      'COMPUTER': 'COMP',
      'COMPUTER STUDIES': 'COMP',
      'CIVIC': 'CIVIC',
      'CIVIC EDUCATION': 'CIVIC',
      'ISLAMIC STUDIES': 'IRS',
      'ISLAMIC RELIGIOUS STUDIES': 'IRS',
      'IRS': 'IRS',
      'HAUSA': 'HAUSA',
      'HAUSA LANGUAGE': 'HAUSA',
      'GEOGRAPHY': 'GEO',
      'COMMERCE': 'COMM',
      'GOVERNMENT': 'GOVT',
      'BUSINESS STUDIES': 'BUS',
      'BUSINESS STUDY': 'BUS',
      'PRE-VOCATIONAL STUDIES': 'PVS',
      'PRE-VOCATIONAL STUDY': 'PVS',
      'PVS': 'PVS',
      'NATIONAL VALUE': 'NV',
      'NATIONAL VALUES': 'NV',
      'NATIONAL VALUES EDUCATION': 'NV',
      'NV': 'NV'
    };
    return map[val] || code || name;
  };

  const getClassName = (slot) => {
    if (!slot) return '';
    return slot.class_name || classMap[slot.class_id] || (slot.class_id ? `Class #${slot.class_id}` : '');
  };

  // Render a block of periods with double period merging
  const renderPeriodRange = (dayKey, startPeriod, endPeriod) => {
    const cells = [];
    let p = startPeriod;

    while (p <= endPeriod) {
      const slot = slotMap[dayKey]?.[p];
      const nextSlot = p < endPeriod ? slotMap[dayKey]?.[p + 1] : null;

      // Check if double period (same subject & class)
      const isDouble = slot && nextSlot && 
        slot.subject_id === nextSlot.subject_id && 
        slot.class_id === nextSlot.class_id;

      if (isDouble) {
        cells.push(
          <td key={p} colSpan={2}>
            <div className="asc-cell">
              <span className="asc-cell-top-subject">{toShortSubject(slot.subject_name, slot.subject_code)}</span>
              <span className="asc-cell-center-class">
                <span className="asc-class-badge">{getClassName(slot)}</span>
              </span>
            </div>
          </td>
        );
        p += 2;
      } else if (slot) {
        cells.push(
          <td key={p}>
            <div className="asc-cell">
              <span className="asc-cell-top-subject">{toShortSubject(slot.subject_name, slot.subject_code)}</span>
              <span className="asc-cell-center-class">
                <span className="asc-class-badge">{getClassName(slot)}</span>
              </span>
            </div>
          </td>
        );
        p += 1;
      } else {
        cells.push(
          <td key={p}>
            <div className="asc-cell-empty"></div>
          </td>
        );
        p += 1;
      }
    }

    return cells;
  };

  return (
    <div className="view-container">
      {/* Clean, simple selector bar */}
      <div className="clean-selector-bar no-print">
        <label className="clean-selector-label" htmlFor="teacher-select">Teacher:</label>
        <select 
          id="teacher-select"
          className="clean-select-input"
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
        >
          {teachers.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Timetable Sheet */}
      <div className="asc-timetable-sheet" id="printable-teacher-sheet">
        {/* Sheet Title */}
        <div className="asc-sheet-header">
          <div className="asc-sheet-title">
            {schoolTitle} {sessionText}
          </div>
          <div className="asc-sheet-subtitle">
            Teacher {currentTeacher.name} {currentTeacher.code ? `(${currentTeacher.code})` : ''}
          </div>
          <div className="asc-teacher-meta">
            <span className="asc-meta-item">
              <strong>Classes:</strong> {teacherClasses.length > 0 ? teacherClasses.join(', ') : 'None'}
            </span>
            <span className="asc-meta-divider">•</span>
            <span className="asc-meta-item">
              <strong>Weekly Load:</strong> {teacherSlots.length} Periods
            </span>
            <span className="asc-meta-divider">•</span>
            <span className="asc-meta-item">
              <strong>Schedule:</strong> {
                currentTeacher.time_preference === 'MORNING_ONLY'
                  ? 'Morning Only (P1–P4/5)'
                  : (currentTeacher.unavailable_days && currentTeacher.unavailable_days.includes('Friday')
                      ? 'Mon–Thu (Friday Free)'
                      : 'Balanced (P1–P8)')
              }
            </span>
          </div>
        </div>

        {/* The Table Grid with rigid Column Widths to never break */}
        <table className="asc-table">
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="asc-th-day">DAY</th>

              {/* Assembly Column (7:40 - 8:10) */}
              <th className="asc-th-assembly">
                <div className="asc-period-number">Ass.</div>
                <div className="asc-period-time">7:40-8:10</div>
              </th>
              
              {/* Period 1 */}
              <th className="asc-th-period">
                <div className="asc-period-number">1</div>
                <div className="asc-period-time">8:10-8:40</div>
              </th>

              {/* Period 2 */}
              <th className="asc-th-period">
                <div className="asc-period-number">2</div>
                <div className="asc-period-time">8:40-9:20</div>
              </th>

              {/* Period 3 */}
              <th className="asc-th-period">
                <div className="asc-period-number">3</div>
                <div className="asc-period-time">9:20-10:00</div>
              </th>

              {/* Period 4 */}
              <th className="asc-th-period">
                <div className="asc-period-number">4</div>
                <div className="asc-period-time">10:00-10:40</div>
              </th>

              {/* Breakfast Header */}
              <th className="asc-break-th">
                <div className="asc-period-number">BREAK</div>
                <div className="asc-period-time">10:40-11:10</div>
              </th>

              {/* Period 5 */}
              <th className="asc-th-period">
                <div className="asc-period-number">5</div>
                <div className="asc-period-time">11:10-11:50</div>
              </th>

              {/* Period 6 */}
              <th className="asc-th-period">
                <div className="asc-period-number">6</div>
                <div className="asc-period-time">11:50-12:30</div>
              </th>

              {/* Period 7 */}
              <th className="asc-th-period">
                <div className="asc-period-number">7</div>
                <div className="asc-period-time">12:30-1:10</div>
              </th>

              {/* Period 8 */}
              <th className="asc-th-period">
                <div className="asc-period-number">8</div>
                <div className="asc-period-time">1:10-1:50</div>
              </th>

              {/* Sweeping Column */}
              <th className="asc-th-sweeping">
                <div className="asc-period-number">Sweep</div>
                <div className="asc-period-time">1:50-2:00</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, index) => {
              const isFri = d.full === 'Friday';
              const isMonOrFri = d.full === 'Monday' || d.full === 'Friday';

              return (
                <tr key={d.full}>
                  {/* Short Day Column */}
                  <td className="asc-day-label">
                    {d.short}
                  </td>

                  {/* Assembly Column (Monday and Friday) */}
                  {isMonOrFri ? (
                    <td className="asc-assembly-cell">
                      Ass.
                    </td>
                  ) : (
                    <td className="asc-assembly-empty"></td>
                  )}

                  {/* Periods 1 to 4 */}
                  {renderPeriodRange(d.full, 1, 4)}

                  {/* BREAK Cell (rendered once on first row with rowSpan=5 in a vertical line) */}
                  {index === 0 && (
                    <td rowSpan={5} className="asc-break-cell">
                      <div className="asc-vertical-break">
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* After Break */}
                  {isFri ? (
                    <>
                      {/* Friday has just 2 periods after break (Periods 5 & 6) */}
                      {renderPeriodRange('Friday', 5, 6)}
                      {/* Periods 7 & 8 are empty on Friday */}
                      <td colSpan={2} className="asc-cell-empty"></td>
                    </>
                  ) : (
                    /* Mon-Thu: Periods 5 to 8 */
                    renderPeriodRange(d.full, 5, 8)
                  )}

                  {/* Sweeping Column */}
                  <td className="asc-sweeping-cell">
                    Sweep
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Clean Note Under the Table */}
        <div className="asc-sheet-note">
          * Note: Friday periods are 30 mins each (P1: 8:10–8:40, P2: 8:40–9:10, P3: 9:10–9:40, P4: 9:40–10:10, Break: 10:10–10:40, P5: 10:40–11:10, P6: 11:10–11:40, Sweep: 11:40–11:50). School closes after Period 6 for Juma'at Prayers & Dismissal.
        </div>
      </div>
    </div>
  );
}
