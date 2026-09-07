import { db, initDatabase } from './db/database.js';

initDatabase();

// Clean database
db.exec('DELETE FROM timetable_slots;');
db.exec('DELETE FROM allocations;');
db.exec('DELETE FROM classes;');
db.exec('DELETE FROM teachers;');
db.exec('DELETE FROM subjects;');

// 1. Classes
const classesData = [
  { name: 'JS 1', level: 'JS', arm: '', room: 'Room 1', class_teacher: 'NABILA M' },
  { name: 'JS 2', level: 'JS', arm: '', room: 'Room 2', class_teacher: 'Mallam Sani' },
  { name: 'JS 3', level: 'JS', arm: '', room: 'Room 3', class_teacher: 'Malama Fatima' },
  { name: 'SS 1', level: 'SS', arm: '', room: 'Room 4', class_teacher: 'Mallam Ibrahim' },
  { name: 'SS 2', level: 'SS', arm: '', room: 'Room 5', class_teacher: 'Malama Maryam' },
  { name: 'SS 3', level: 'SS', arm: '', room: 'Room 6', class_teacher: 'Mallam Kabir' }
];
const insertClass = db.prepare('INSERT INTO classes (name, level, arm, room, class_teacher) VALUES (@name, @level, @arm, @room, @class_teacher)');
for (const c of classesData) insertClass.run(c);

// 2. Teachers
const teachersData = [
  { name: 'M. Shehu', code: 'MSH', phone: '08031122334', max_daily_periods: 5, time_preference: 'MORNING_ONLY' },
  { name: 'M. Mubarak', code: 'MMB', phone: '08032233445', max_daily_periods: 5, time_preference: 'ANY' },
  { name: 'M. Hassan', code: 'MHN', phone: '08033445566', max_daily_periods: 6, time_preference: 'ANY' },
  { name: 'M. Nana Firdaus', code: 'MNF', phone: '08034556677', max_daily_periods: 6, time_preference: 'ANY' }
];
const insertTeacher = db.prepare('INSERT INTO teachers (name, code, phone, max_daily_periods, time_preference) VALUES (@name, @code, @phone, @max_daily_periods, COALESCE(@time_preference, \'ANY\'))');
for (const t of teachersData) insertTeacher.run(t);

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
  { name: 'CIVIC', code: 'CIV', category: 'General', color: '#6d28d9' },
  { name: 'AGRIC', code: 'AGR', category: 'Vocational', color: '#166534' },
  { name: 'BIO', code: 'BIO', category: 'Senior Science', color: '#059669' },
  { name: 'ECON', code: 'ECO', category: 'Social Sciences', color: '#c2410c' }
];
const insertSubject = db.prepare('INSERT INTO subjects (name, code, category, color) VALUES (@name, @code, @category, @color)');
for (const s of subjectsData) insertSubject.run(s);

const classes = db.prepare('SELECT id, name FROM classes').all();
const teachers = db.prepare('SELECT id, name, code, time_preference, max_daily_periods FROM teachers').all();
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
  allocations.push({
    class_id: classMap[className],
    subject_id: subjectMap[subjectCode],
    teacher_id: teacherMap[teacherCode],
    periods_per_week: periods,
    allow_double: allowDouble
  });
};

// Teacher 1: M. Shehu (22)
addAlloc('SS 1', 'PHY', 'MSH', 4, 1);
addAlloc('SS 2', 'PHY', 'MSH', 4, 1);
addAlloc('SS 3', 'PHY', 'MSH', 4, 1);
addAlloc('JS 3', 'MTH', 'MSH', 5, 2);
addAlloc('SS 1', 'MTH', 'MSH', 5, 2);

// Teacher 2: M. Mubarak (19)
addAlloc('JS 1', 'MTH', 'MMB', 5, 2);
addAlloc('JS 2', 'MTH', 'MMB', 5, 2);
addAlloc('SS 1', 'DPR', 'MMB', 3, 0);
addAlloc('SS 2', 'DPR', 'MMB', 3, 0);
addAlloc('SS 3', 'DPR', 'MMB', 3, 0);

// Teacher 3: M. Hassan (24)
// Government (paired with Physics)
addAlloc('SS 1', 'GOV', 'MHN', 4, 1);
addAlloc('SS 2', 'GOV', 'MHN', 4, 1);
addAlloc('SS 3', 'GOV', 'MHN', 4, 1);
// Literature (paired with Chemistry)
addAlloc('SS 1', 'LIT', 'MHN', 4, 1);
addAlloc('SS 2', 'LIT', 'MHN', 4, 1);
addAlloc('SS 3', 'LIT', 'MHN', 4, 1);

// Teacher 4: M. Nana Firdaus (24)
// Chemistry (paired with Literature)
addAlloc('SS 1', 'CHM', 'MNF', 4, 1);
addAlloc('SS 2', 'CHM', 'MNF', 4, 1);
addAlloc('SS 3', 'CHM', 'MNF', 4, 1);
// Basic Science & Tech
addAlloc('JS 1', 'BST', 'MNF', 4, 1);
addAlloc('JS 2', 'BST', 'MNF', 4, 1);
addAlloc('JS 3', 'BST', 'MNF', 4, 1);

const insertAlloc = db.prepare('INSERT INTO allocations (class_id, subject_id, teacher_id, periods_per_week, allow_double) VALUES (?, ?, ?, ?, ?)');
for (const a of allocations) {
  insertAlloc.run(a.class_id, a.subject_id, a.teacher_id, a.periods_per_week, a.allow_double);
}

console.log(`Database populated with: ${teachers.length} teachers, ${allocations.length} allocations.`);
const totalPeriods = allocations.reduce((sum, a) => sum + a.periods_per_week, 0);
console.log(`Total weekly periods across all teachers: ${totalPeriods}`);
