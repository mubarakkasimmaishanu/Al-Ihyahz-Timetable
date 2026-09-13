import { db, initDatabase } from './database.js';
import { fileURLToPath } from 'node:url';
import { TimetableGenerator } from '../engine/generator.js';

export function seedDatabase() {
  db.exec('DROP TABLE IF EXISTS timetable_slots;');
  initDatabase();

  // Clear existing data
  db.exec('DELETE FROM allocations;');
  db.exec('DELETE FROM classes;');
  db.exec('DELETE FROM teachers;');
  db.exec('DELETE FROM subjects;');

  // Update settings to match the template exactly
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('school_name', 'AL-IHYAZ ACADEMY')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('academic_session', '2025/26 TIME TABLE')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('designer_credit', 'Designed by Engr. U. F. Lukman (07035912499)')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('footer_right', 'aSc Timetables')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('regular_periods_per_day', '8')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('friday_periods_per_day', '6')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('period_times', ?)").run(JSON.stringify([
    { period: 1, start: '8:00', end: '8:40', label: '1', note: 'Assembly on Mon & Fri (8:00-8:40)' },
    { period: 2, start: '8:40', end: '9:20', label: '2' },
    { period: 3, start: '9:20', end: '10:00', label: '3' },
    { period: 4, start: '10:00', end: '10:40', label: '4' },
    { period: 0, type: 'break', name: 'BREAK FAST', start: '10:40', end: '11:10' },
    { period: 5, start: '11:10', end: '11:50', label: '5' },
    { period: 6, start: '11:50', end: '12:30', label: '6' },
    { period: 7, start: '12:30', end: '1:10', label: '7' },
    { period: 8, start: '1:10', end: '1:50', label: '8' }
  ]));

  console.log('Seeding Al-Ihyaz Academy (JS 1-3, SS 1-3) with Teacher NABILA M & mixed staff...');

  // 1. Exactly 6 Classes as named on the template
  const classesData = [
    { name: 'JS 1', level: 'JS', arm: '', room: 'Room 1', class_teacher: 'NABILA M' },
    { name: 'JS 2', level: 'JS', arm: '', room: 'Room 2', class_teacher: 'Mallam Sani' },
    { name: 'JS 3', level: 'JS', arm: '', room: 'Room 3', class_teacher: 'Malama Fatima' },
    { name: 'SS 1', level: 'SS', arm: '', room: 'Room 4', class_teacher: 'Mallam Ibrahim' },
    { name: 'SS 2', level: 'SS', arm: '', room: 'Room 5', class_teacher: 'Malama Maryam' },
    { name: 'SS 3', level: 'SS', arm: '', room: 'Room 6', class_teacher: 'Mallam Kabir' }
  ];

  const insertClass = db.prepare(`
    INSERT INTO classes (name, level, arm, room, class_teacher) 
    VALUES (@name, @level, @arm, @room, @class_teacher)
  `);
  for (const c of classesData) {
    insertClass.run(c);
  }

  // 2. Teachers:
  const teachersData = [
    { name: 'M. Shehu', code: 'MSH', phone: '08031122334', max_daily_periods: 6, time_preference: 'MORNING_ONLY', unavailable_days: JSON.stringify(['Friday']) },
    { name: 'M. Mubarak', code: 'MMB', phone: '08032233445', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Hassan', code: 'MHN', phone: '08033445566', max_daily_periods: 6, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Nana Firdaus', code: 'MNF', phone: '08034556677', max_daily_periods: 6, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Yusuf', code: 'MYS', phone: '08035667788', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Zainab Kabir', code: 'MZK', phone: '08036677889', max_daily_periods: 6, time_preference: 'ANY', unavailable_days: JSON.stringify(['Friday']) },
    { name: 'M. Sumayya', code: 'MSM', phone: '08037788990', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Abba', code: 'MAB', phone: '08038899001', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Amina', code: 'MAM', phone: '08039900112', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Maryam', code: 'MMY', phone: '08031122445', max_daily_periods: 6, time_preference: 'ANY', unavailable_days: '[]' },
    { name: 'M. Nabila', code: 'MNB', phone: '08031122556', max_daily_periods: 5, time_preference: 'ANY', unavailable_days: '[]' }
  ];

  const insertTeacher = db.prepare(`
    INSERT INTO teachers (name, code, phone, max_daily_periods, time_preference, unavailable_days) 
    VALUES (@name, @code, @phone, @max_daily_periods, COALESCE(@time_preference, 'ANY'), COALESCE(@unavailable_days, '[]'))
  `);
  for (const t of teachersData) {
    insertTeacher.run(t);
  }

  // 3. Subjects
  const subjectsData = [
    { name: 'PHY', code: 'PHY', category: 'Senior Science', color: '#7c3aed' },
    { name: 'MATHS', code: 'MTH', category: 'Core', color: '#1d4ed8' },
    { name: 'DATA', code: 'DPR', category: 'Technology', color: '#0891b2' },
    { name: 'GOVT', code: 'GOV', category: 'Senior Arts', color: '#9333ea' },
    { name: 'LIT', code: 'LIT', category: 'Senior Arts', color: '#c026d3' },
    { name: 'CHEM', code: 'CHM', category: 'Senior Science', color: '#be185d' },
    { name: 'BST', code: 'BST', category: 'Junior Science', color: '#0284c7' },
    { name: 'IRS', code: 'IRS', category: 'Religious', color: '#15803d' },
    { name: 'HAUSA', code: 'HAUSA', category: 'Language', color: '#b45309' },
    { name: 'ENG', code: 'ENG', category: 'Core', color: '#0369a1' },
    { name: 'B.SCI', code: 'BSC', category: 'Junior Science', color: '#4338ca' },
    { name: 'B.TECH', code: 'BTECH', category: 'Junior Tech', color: '#0f766e' },
    { name: 'CIVIC', code: 'CIV', category: 'General', color: '#6d28d9' },
    { name: 'COMP', code: 'CMP', category: 'Technology', color: '#0284c7' },
    { name: 'AGRIC', code: 'AGR', category: 'Vocational', color: '#166534' },
    { name: 'BIO', code: 'BIO', category: 'Senior Science', color: '#059669' },
    { name: 'ECON', code: 'ECO', category: 'Social Sciences', color: '#c2410c' },
    { name: 'BUS', code: 'BUS', category: 'Pre-Vocational', color: '#ea580c' },
    { name: 'PVS', code: 'PVS', category: 'Pre-Vocational', color: '#b45309' },
    { name: 'NV', code: 'NV', category: 'Social Sciences', color: '#4f46e5' },
    { name: 'STUDY / LIB', code: 'STP', category: 'General', color: '#64748b' }
  ];

  const insertSubject = db.prepare(`
    INSERT INTO subjects (name, code, category, color) 
    VALUES (@name, @code, @category, @color)
  `);
  for (const s of subjectsData) {
    insertSubject.run(s);
  }

  // Fetch IDs
  const classes = db.prepare('SELECT id, name FROM classes').all();
  const teachers = db.prepare('SELECT id, name, code FROM teachers').all();
  const subjects = db.prepare('SELECT id, name, code FROM subjects').all();

  const classMap = Object.fromEntries(classes.map(c => [c.name, c.id]));
  const teacherMap = {
    ...Object.fromEntries(teachers.map(t => [t.code, t.id])),
    ...Object.fromEntries(teachers.map(t => [t.name, t.id]))
  };
  const subjectMap = {
    ...Object.fromEntries(subjects.map(s => [s.code, s.id])),
    ...Object.fromEntries(subjects.map(s => [s.name, s.id]))
  };

  const allocations = [];
  const addAlloc = (className, subjectCode, teacherCode, periods, allowDouble = 0) => {
    const classId = classMap[className];
    const subjectId = subjectMap[subjectCode];
    const teacherId = teacherMap[teacherCode];

    if (!classId || !subjectId || !teacherId) {
      console.error(`Error resolving allocation: class=${className} (${classId}), subject=${subjectCode} (${subjectId}), teacher=${teacherCode} (${teacherId})`);
    }

    allocations.push({
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      periods_per_week: periods,
      allow_double: allowDouble
    });
  };

  // =========================================================================
  // TEACHER #1: M. SHEHU (MSc Student - ALL CLASSES IN MORNING)
  // Total = 22 periods / week
  // =========================================================================
  addAlloc('SS 1', 'PHY', 'MSH', 4, 1);
  addAlloc('SS 2', 'PHY', 'MSH', 4, 1);
  addAlloc('SS 3', 'PHY', 'MSH', 4, 1);
  addAlloc('JS 3', 'MTH', 'MSH', 5, 2);
  addAlloc('SS 1', 'MTH', 'MSH', 5, 2);

  // =========================================================================
  // TEACHER #2: M. MUBARAK
  // Total = 21 periods / week (10 Maths in JS 1-2 + 11 DPR in SS 1-3)
  // =========================================================================
  addAlloc('JS 1', 'MTH', 'MMB', 5, 2);
  addAlloc('JS 2', 'MTH', 'MMB', 5, 2);
  addAlloc('SS 1', 'DPR', 'MMB', 4, 1);
  addAlloc('SS 2', 'DPR', 'MMB', 4, 1);
  addAlloc('SS 3', 'DPR', 'MMB', 3, 0);

  // =========================================================================
  // TEACHER #3: M. HASSAN
  // Total = 24 periods / week (12 morning GOV paired w/ PHY, 12 LIT paired w/ BIO)
  // =========================================================================
  addAlloc('SS 1', 'GOV', 'MHN', 4, 1);
  addAlloc('SS 2', 'GOV', 'MHN', 4, 1);
  addAlloc('SS 3', 'GOV', 'MHN', 4, 1);
  addAlloc('SS 1', 'LIT', 'MHN', 4, 1);
  addAlloc('SS 2', 'LIT', 'MHN', 4, 1);
  addAlloc('SS 3', 'LIT', 'MHN', 4, 1);

  // =========================================================================
  // TEACHER #4: M. NANA FIRDAUS
  // Total = 24 periods / week (12 morning BST, 12 CHM paired w/ ECO)
  // =========================================================================
  addAlloc('SS 1', 'CHM', 'MNF', 4, 1);
  addAlloc('SS 2', 'CHM', 'MNF', 4, 1);
  addAlloc('SS 3', 'CHM', 'MNF', 4, 1);
  addAlloc('JS 1', 'BST', 'MNF', 4, 1);
  addAlloc('JS 2', 'BST', 'MNF', 4, 1);
  addAlloc('JS 3', 'BST', 'MNF', 4, 1);

  // =========================================================================
  // TEACHER #5: M. YUSUF
  // Total = 16 periods / week:
  // - Mathematics in SS 2 & SS 3 (5 contacts each = 10, 2 doubles + 1 single each)
  // - Islamic Studies (IRS) in JS 3 (3 contacts = 3)
  // - Study Period / Library (STP) in JS 1, JS 2, JS 3 (1 contact each = 3)
  // =========================================================================
  addAlloc('SS 2', 'MTH', 'MYS', 5, 2);
  addAlloc('SS 3', 'MTH', 'MYS', 5, 2);
  addAlloc('JS 3', 'IRS', 'MYS', 3, 0);
  addAlloc('JS 1', 'STP', 'MYS', 1, 0);
  addAlloc('JS 2', 'STP', 'MYS', 1, 0);
  addAlloc('JS 3', 'STP', 'MYS', 1, 0);

  // =========================================================================
  // TEACHER #6: M. ZAINAB KABIR (Friday Absent, Balanced Workload)
  // Total = 24 periods / week (15 English [2 doubles + 1 single each] + 9 Business Studies)
  // =========================================================================
  addAlloc('JS 1', 'ENG', 'MZK', 5, 2);
  addAlloc('JS 2', 'ENG', 'MZK', 5, 2);
  addAlloc('JS 3', 'ENG', 'MZK', 5, 2);
  addAlloc('JS 1', 'BUS', 'MZK', 3, 0);
  addAlloc('JS 2', 'BUS', 'MZK', 3, 0);
  addAlloc('JS 3', 'BUS', 'MZK', 3, 0);

  // =========================================================================
  // TEACHER #7: M. SUMAYYA
  // Total = 24 periods / week (15 English in SS 1-3 [2 doubles + 1 single each] + 9 Computer in JS 1-3)
  // Balanced Workload (max 5/day) & English Protected From Tired Hours
  // =========================================================================
  addAlloc('SS 1', 'ENG', 'MSM', 5, 2);
  addAlloc('SS 2', 'ENG', 'MSM', 5, 2);
  addAlloc('SS 3', 'ENG', 'MSM', 5, 2);
  addAlloc('JS 1', 'CMP', 'MSM', 3, 0);
  addAlloc('JS 2', 'CMP', 'MSM', 3, 0);
  addAlloc('JS 3', 'CMP', 'MSM', 3, 0);

  // =========================================================================
  // TEACHER #8: M. ABBA
  // Total = 23 periods / week (12 Economics paired w/ Chemistry in SS 1-3 + 11 Civic in SS 1-3)
  // Balanced Workload (max 5/day)
  // =========================================================================
  addAlloc('SS 1', 'ECO', 'MAB', 4, 1);
  addAlloc('SS 2', 'ECO', 'MAB', 4, 1);
  addAlloc('SS 3', 'ECO', 'MAB', 4, 1);
  addAlloc('SS 1', 'CIV', 'MAB', 3, 0);
  addAlloc('SS 2', 'CIV', 'MAB', 4, 1);
  addAlloc('SS 3', 'CIV', 'MAB', 4, 1);

  // =========================================================================
  // TEACHER #9: M. AMINA
  // Total = 23 periods / week (12 Biology paired w/ Literature in SS 1-3 + 11 Agric in SS 1-3)
  // Balanced Workload 50/50 before/after break (max 5/day)
  // =========================================================================
  addAlloc('SS 1', 'BIO', 'MAM', 4, 1);
  addAlloc('SS 2', 'BIO', 'MAM', 4, 1);
  addAlloc('SS 3', 'BIO', 'MAM', 4, 1);
  addAlloc('SS 1', 'AGR', 'MAM', 4, 1);
  addAlloc('SS 2', 'AGR', 'MAM', 3, 0);
  addAlloc('SS 3', 'AGR', 'MAM', 4, 1);

  // =========================================================================
  // TEACHER #10: M. MARYAM
  // Total = 24 periods / week:
  // - Pre-Vocational Studies in JS 1-3 (3 contacts each = 9)
  // - National Values in JS 1-3 (4 contacts each = 12, 1 double + 2 singles each)
  // - Islamic Studies (IRS) in JS 1 only (3 contacts = 3)
  // =========================================================================
  addAlloc('JS 1', 'PVS', 'MMY', 3, 0);
  addAlloc('JS 2', 'PVS', 'MMY', 3, 0);
  addAlloc('JS 3', 'PVS', 'MMY', 3, 0);
  addAlloc('JS 1', 'NV', 'MMY', 4, 1);
  addAlloc('JS 2', 'NV', 'MMY', 4, 1);
  addAlloc('JS 3', 'NV', 'MMY', 4, 1);
  addAlloc('JS 1', 'IRS', 'MMY', 3, 0);

  // =========================================================================
  // TEACHER #11: M. NABILA
  // Total = 21 periods / week:
  // - Islamic Studies (IRS) SS 1-3 (3 contacts each = 9)
  // - Hausa (HAUSA) JS 1-3 (3 contacts each = 9)
  // - Islamic Studies (IRS) JS 2 only (3 contacts = 3)
  // Balanced Workload (max 5/day)
  // =========================================================================
  addAlloc('SS 1', 'IRS', 'MNB', 3, 0);
  addAlloc('SS 2', 'IRS', 'MNB', 3, 0);
  addAlloc('SS 3', 'IRS', 'MNB', 3, 0);
  addAlloc('JS 1', 'HAUSA', 'MNB', 3, 0);
  addAlloc('JS 2', 'HAUSA', 'MNB', 3, 0);
  addAlloc('JS 3', 'HAUSA', 'MNB', 3, 0);
  addAlloc('JS 2', 'IRS', 'MNB', 3, 0);

  const insertAlloc = db.prepare(`
    INSERT INTO allocations (class_id, subject_id, teacher_id, periods_per_week, allow_double)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const a of allocations) {
    insertAlloc.run(a.class_id, a.subject_id, a.teacher_id, a.periods_per_week, a.allow_double);
  }

  console.log(`Seeding complete: ${classesData.length} classes, ${teachersData.length} teachers, ${subjectsData.length} subjects, ${allocations.length} allocations.`);

  // Automatically generate conflict-free timetable slots into database
  console.log('Generating conflict-free timetable slots...');
  const dbClasses = db.prepare('SELECT * FROM classes').all();
  const dbTeachers = db.prepare('SELECT * FROM teachers').all();
  const dbSubjects = db.prepare('SELECT * FROM subjects').all();
  const dbAllocations = db.prepare('SELECT * FROM allocations').all();

  const generator = new TimetableGenerator({
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    regularPeriods: 8,
    fridayPeriods: 6,
    maxRestarts: 300
  });

  const result = generator.generate(dbClasses, dbTeachers, dbSubjects, dbAllocations);
  if (result.success && result.slots.length > 0) {
    const insertSlot = db.prepare(`
      INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
      VALUES (@class_id, @subject_id, @teacher_id, @day, @period_index, @is_locked)
    `);
    for (const slot of result.slots) {
      insertSlot.run(slot);
    }
    console.log(`Timetable generated successfully: ${result.slots.length} conflict-free slots saved to database.`);
  } else {
    console.warn('Warning: Could not automatically generate 100% clash-free slots during seed.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase();
}
