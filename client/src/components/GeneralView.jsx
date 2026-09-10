import React, { useState, useMemo } from 'react';

export default function GeneralView({ classes = [], teachers = [], slots = [], settings = {} }) {
  const [selectedDayKey, setSelectedDayKey] = useState('Monday');
  const [viewMode, setViewMode] = useState('CLASSES'); // 'CLASSES' or 'TEACHERS'

  const days = [
    { key: 'Monday', label: 'Mon' },
    { key: 'Tuesday', label: 'Tue' },
    { key: 'Wednesday', label: 'Wed' },
    { key: 'Thursday', label: 'Thu' },
    { key: 'Friday', label: 'Fri' }
  ];

  const schoolTitle = settings.school_name || 'AL-IHYAZ ACADEMY';
  const sessionText = settings.academic_session || '2025/26 TIME TABLE';

  const isFriday = selectedDayKey === 'Friday';

  const classMap = useMemo(() => {
    return Object.fromEntries((classes || []).map(c => [c.id, c.name]));
  }, [classes]);

  // Slot lookup by class: classSlotMap[class_id][day][period] = array of slots
  const classSlotMap = useMemo(() => {
    const map = {};
    for (const c of classes) {
      map[c.id] = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
    }
    for (const s of slots) {
      if (map[s.class_id] && map[s.class_id][s.day]) {
        if (!map[s.class_id][s.day][s.period_index]) {
          map[s.class_id][s.day][s.period_index] = [];
        }
        map[s.class_id][s.day][s.period_index].push(s);
      }
    }
    return map;
  }, [classes, slots]);

  // Slot lookup by teacher: teacherSlotMap[teacher_id][day][period] = slot
  const teacherSlotMap = useMemo(() => {
    const map = {};
    for (const t of teachers) {
      map[t.id] = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
    }
    for (const s of slots) {
      if (map[s.teacher_id] && map[s.teacher_id][s.day]) {
        map[s.teacher_id][s.day][s.period_index] = s;
      }
    }
    return map;
  }, [teachers, slots]);

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

  const getClassName = (slot) => {
    if (!slot) return '';
    return slot.class_name || classMap[slot.class_id] || (slot.class_id ? `Class #${slot.class_id}` : '');
  };

  const activeDayObj = days.find(d => d.key === selectedDayKey) || days[0];

  const rows = viewMode === 'TEACHERS' ? teachers : classes;

  return (
    <div className="view-container">
      {/* Clean Controls Bar */}
      <div className="clean-selector-bar no-print" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Toggle View Mode: By Classes or By Teachers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="clean-selector-label">General View By:</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              id="general-view-by-classes"
              className={`clean-day-btn ${viewMode === 'CLASSES' ? 'active' : ''}`}
              onClick={() => setViewMode('CLASSES')}
            >
              Classes
            </button>
            <button
              id="general-view-by-teachers"
              className={`clean-day-btn ${viewMode === 'TEACHERS' ? 'active' : ''}`}
              onClick={() => setViewMode('TEACHERS')}
            >
              Teachers
            </button>
          </div>
        </div>

        {/* Day Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="clean-selector-label">Day:</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {days.map(d => (
              <button
                key={d.key}
                id={`general-day-${d.key.toLowerCase()}`}
                className={`clean-day-btn ${selectedDayKey === d.key ? 'active' : ''}`}
                onClick={() => setSelectedDayKey(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Master Timetable Sheet */}
      <div className="asc-timetable-sheet" id="printable-general-sheet">
        {/* Header */}
        <div className="asc-sheet-header">
          <div className="asc-sheet-title">
            {schoolTitle} {sessionText}
          </div>
          <div className="asc-sheet-subtitle">
            GENERAL TIME TABLE (BY {viewMode}) — {activeDayObj.label.toUpperCase()}
          </div>
        </div>

        {/* Master Table Grid */}
        <table className="asc-table">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '10.5%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="asc-th-day">{viewMode === 'TEACHERS' ? 'TEACHER' : 'CLASS'}</th>
              
              {/* Period 1 */}
              <th className="asc-th-period">
                <div className="asc-period-number">1</div>
                <div className="asc-period-time">8:00-8:40</div>
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

              {/* Breakfast */}
              <th className="asc-break-th">
                <div className="asc-period-number" style={{ fontSize: '0.82rem' }}>BREAK</div>
                <div className="asc-period-time">10:40-11:10</div>
              </th>

              {/* Period 5 */}
              <th className="asc-th-period">
                <div className="asc-period-number">5</div>
                <div className="asc-period-time">{isFriday ? '10:40-11:20' : '11:10-11:50'}</div>
              </th>

              {/* Period 6 */}
              <th className="asc-th-period">
                <div className="asc-period-number">6</div>
                <div className="asc-period-time">{isFriday ? '11:20-12:00' : '11:50-12:30'}</div>
              </th>

              {/* Period 7 */}
              <th className="asc-th-period">
                <div className="asc-period-number">7</div>
                <div className="asc-period-time">{isFriday ? '—' : '12:30-1:10'}</div>
              </th>

              {/* Period 8 */}
              <th className="asc-th-period">
                <div className="asc-period-number">8</div>
                <div className="asc-period-time">{isFriday ? '—' : '1:10-1:50'}</div>
              </th>

              {/* Sweeping Column */}
              <th className="asc-th-sweeping">
                <div className="asc-period-number">Sweep</div>
                <div className="asc-period-time">1:50-2:00</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rowItem, index) => {
              const isMonOrFri = selectedDayKey === 'Monday' || selectedDayKey === 'Friday';
              const rowLabel = viewMode === 'TEACHERS' ? (rowItem.name || rowItem.code) : rowItem.name;

              const getSlot = (period) => {
                if (viewMode === 'TEACHERS') {
                  return teacherSlotMap[rowItem.id]?.[selectedDayKey]?.[period];
                }
                return classSlotMap[rowItem.id]?.[selectedDayKey]?.[period] || [];
              };

              const renderCellContent = (slotData) => {
                if (!slotData) return <div className="asc-cell-empty"></div>;
                if (viewMode === 'TEACHERS') {
                  const slot = slotData;
                  if (!slot) return <div className="asc-cell-empty"></div>;
                  // In Teachers view, show SUBJECT at top and CLASS prominently in center!
                  return (
                    <div className="asc-cell">
                      <span className="asc-cell-top-subject">{toShortSubject(slot.subject_name, slot.subject_code)}</span>
                      <span className="asc-cell-center-class">
                        <span className="asc-class-badge">{getClassName(slot)}</span>
                      </span>
                    </div>
                  );
                }
                // In Classes view: slotData is an array of slots
                const slotList = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                if (slotList.length === 0) return <div className="asc-cell-empty"></div>;
                if (slotList.length === 1) {
                  const slot = slotList[0];
                  return (
                    <div className="asc-cell">
                      <span className="asc-cell-top-teacher">{slot.teacher_name || slot.teacher_code}</span>
                      <span className="asc-cell-center-subject">{toShortSubject(slot.subject_name, slot.subject_code)}</span>
                    </div>
                  );
                }
                // Paired electives
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

              return (
                <tr key={rowItem.id}>
                  {/* Row Label (Class name or Teacher name) */}
                  <td className="asc-day-label">
                    {rowLabel}
                  </td>

                  {/* Periods 1 to 4 */}
                  {[1, 2, 3, 4].map(p => {
                    if (p === 1 && isMonOrFri) {
                      return (
                        <td key={p} className="asc-assembly-cell">
                          <div className="asc-assembly-badge">ASSEMBLY</div>
                        </td>
                      );
                    }
                    return (
                      <td key={p}>
                        {renderCellContent(getSlot(p))}
                      </td>
                    );
                  })}

                  {/* BREAK Cell (rendered once on first row with rowSpan in a vertical line) */}
                  {index === 0 && (
                    <td rowSpan={rows.length} className="asc-break-cell">
                      <div className="asc-vertical-break">
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* After Break: Periods 5 to 8 */}
                  {[5, 6, 7, 8].map(p => (
                    <td key={p}>
                      {renderCellContent(getSlot(p))}
                    </td>
                  ))}

                  {/* Sweeping Column */}
                  <td className="asc-sweeping-cell">
                    Sweep
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Clean Note Under the Master Table */}
        <div className="asc-sheet-note">
          * Note: Period 1 (8:00–8:40 AM) on Monday and Friday is dedicated to School Assembly across all classes. On Friday, school operates morning sessions before Juma'at prayers (Junior classes dismiss at Period 4 / 10:40 AM; Senior classes dismiss at Period 6 / 12:00 PM). Zero classes scheduled after break across all classes.
        </div>
      </div>
    </div>
  );
}
