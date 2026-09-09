import React, { useState, useMemo } from 'react';

export default function ClassView({ classes, teachers = [], allocations = [], slots, settings }) {
  const [selectedClassId, setSelectedClassId] = useState(() => classes[0]?.id || '');

  const currentClass = useMemo(() => {
    return classes.find(c => String(c.id) === String(selectedClassId)) || classes[0];
  }, [classes, selectedClassId]);

  const classSlots = useMemo(() => {
    if (!currentClass) return [];
    return slots.filter(s => String(s.class_id) === String(currentClass.id));
  }, [slots, currentClass]);

  // Slot lookup: slotMap[day][period] = array of slots in that period
  const slotMap = useMemo(() => {
    const map = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
    for (const s of classSlots) {
      if (!map[s.day]) map[s.day] = {};
      if (!map[s.day][s.period_index]) map[s.day][s.period_index] = [];
      map[s.day][s.period_index].push(s);
    }
    return map;
  }, [classSlots]);

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

  if (!currentClass) {
    return <div style={{ padding: '16px' }}>Loading classes...</div>;
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

  const renderCellSlots = (slotList) => {
    if (!slotList || slotList.length === 0) {
      return <div className="asc-cell-empty"></div>;
    }
    if (slotList.length === 1) {
      const slot = slotList[0];
      return (
        <div className="asc-cell">
          <span className="asc-cell-top-teacher">{slot.teacher_name || slot.teacher_code}</span>
          <span className="asc-cell-center-subject">{toShortSubject(slot.subject_name, slot.subject_code)}</span>
        </div>
      );
    }
    // Paired simultaneous electives (e.g. Science / Arts: PHY w/ M. Shehu & GOV w/ M. Hassan)
    const slotA = slotList[0];
    const slotB = slotList[1];
    return (
      <div className="asc-cell asc-cell-paired">
        <div className="asc-paired-teachers">
          <span>{slotA.teacher_name || slotA.teacher_code}</span>
          <span className="asc-paired-sep">|</span>
          <span>{slotB.teacher_name || slotB.teacher_code}</span>
        </div>
        <div className="asc-paired-subjects">
          <span>{toShortSubject(slotA.subject_name, slotA.subject_code)}</span>
          <span className="asc-paired-sep">/</span>
          <span>{toShortSubject(slotB.subject_name, slotB.subject_code)}</span>
        </div>
      </div>
    );
  };

  // Render range of periods with double period merging
  const renderPeriodRange = (dayKey, startPeriod, endPeriod) => {
    const cells = [];
    let p = startPeriod;

    while (p <= endPeriod) {
      const curSlots = slotMap[dayKey]?.[p] || [];
      const nextSlots = p < endPeriod ? (slotMap[dayKey]?.[p + 1] || []) : [];

      // Check if double period (same subject & teacher)
      let isDouble = false;
      if (curSlots.length > 0 && curSlots.length === nextSlots.length) {
        if (curSlots.length === 1) {
          isDouble = curSlots[0].subject_id === nextSlots[0].subject_id && 
                     curSlots[0].teacher_id === nextSlots[0].teacher_id;
        } else if (curSlots.length === 2) {
          const cSig = curSlots.map(s => `${s.subject_id}_${s.teacher_id}`).sort().join('|');
          const nSig = nextSlots.map(s => `${s.subject_id}_${s.teacher_id}`).sort().join('|');
          isDouble = cSig === nSig;
        }
      }

      if (isDouble) {
        cells.push(
          <td key={p} colSpan={2}>
            {renderCellSlots(curSlots)}
          </td>
        );
        p += 2;
      } else if (curSlots.length > 0) {
        cells.push(
          <td key={p}>
            {renderCellSlots(curSlots)}
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
      {/* Clean selector bar */}
      <div className="clean-selector-bar no-print">
        <label className="clean-selector-label" htmlFor="class-select">Class:</label>
        <select 
          id="class-select"
          className="clean-select-input"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              Class {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Timetable Sheet */}
      <div className="asc-timetable-sheet" id="printable-class-sheet">
        {/* Header */}
        <div className="asc-sheet-header">
          <div className="asc-sheet-title">
            {schoolTitle} {sessionText}
          </div>
          <div className="asc-sheet-subtitle">
            Class {currentClass.name}
          </div>
          <div className="asc-teacher-meta">
            <span className="asc-meta-item">
              <strong>Class Teacher:</strong> {currentClass.class_teacher || 'Not assigned'}
            </span>
            <span className="asc-meta-divider">•</span>
            <span className="asc-meta-item">
              <strong>Room:</strong> {currentClass.room || 'General Room'}
            </span>
            <span className="asc-meta-divider">•</span>
            <span className="asc-meta-item">
              <strong>Weekly Periods:</strong> {classSlots.length} Periods
            </span>
          </div>
        </div>

        {/* The Table Grid */}
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
