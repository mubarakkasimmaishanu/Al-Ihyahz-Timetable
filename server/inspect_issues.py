import json
import sqlite3
from collections import defaultdict

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()

classes = {row[0]: {'id': row[0], 'name': row[1], 'level': row[2]} for row in cursor.execute('SELECT id, name, level FROM classes')}
teachers = {row[0]: {'id': row[0], 'name': row[1]} for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: {'id': row[0], 'code': row[1], 'name': row[2]} for row in cursor.execute('SELECT id, code, name FROM subjects')}

TARGET_P8 = {
    'M. Shehu': 0,
    'M. Hassan': 0,
    'M. Nana Firdaus': 0,
    'M. Mubarak': 3,
    'M. Yusuf': 3,
    'M. Zainab Kabir': 3,
    'M. Sumayya': 3,
    'M. Abba': 3,
    'M. Amina': 3,
    'M. Maryam': 3,
    'M. Nabila': 3
}

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

hard_issues = []
p8_issues = []
double_double_issues = []
adjacent_issues = []

# 1. Teacher clashes
teacher_time = defaultdict(list)
for s in slts:
    key = (s['teacher_id'], s['day'], s['period_index'])
    teacher_time[key].append(s)
    if len(teacher_time[key]) > 1:
        t_name = teachers[s['teacher_id']]['name']
        hard_issues.append(f"Teacher {t_name} clash at {s['day']} P{s['period_index']}")

# 2. Class clashes
class_time = defaultdict(list)
for s in slts:
    key = (s['class_id'], s['day'], s['period_index'])
    class_time[key].append(s)

for key, grp in class_time.items():
    if len(grp) > 1:
        if len(grp) == 2:
            c1 = subjects[grp[0]['subject_id']]['code']
            c2 = subjects[grp[1]['subject_id']]['code']
            pair = "/".join(sorted([c1, c2]))
            if pair not in ['GOV/PHY', 'CHM/ECO', 'BIO/LIT']:
                hard_issues.append(f"Illegal simultaneous {pair} at {key}")
        else:
            hard_issues.append(f"Overbooked class at {key}")

# 3. Period 8 counts
p8_counts = defaultdict(int)
for s in slts:
    if s['period_index'] == 8:
        t_name = teachers[s['teacher_id']]['name']
        p8_counts[t_name] += 1

print("--- Period 8 Counts ---")
for t_id, t in teachers.items():
    t_name = t['name']
    actual = p8_counts[t_name]
    target = TARGET_P8.get(t_name, 0)
    print(f"{t_name.ljust(20)}: actual={actual}, target={target}")
    if actual != target:
        p8_issues.append(f"P8 count mismatch: {t_name} has {actual}, target {target}")

# 4. Double-doubles
for t_id, t in teachers.items():
    for d in DAYS:
        t_slots = [s for s in slts if s['teacher_id'] == t_id and s['day'] == d]
        # Morning doubles
        m_doubles = []
        for p in range(1, 4):
            s1 = next((s for s in t_slots if s['period_index'] == p), None)
            s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                m_doubles.append((p, p+1, classes[s1['class_id']]['name'], subjects[s1['subject_id']]['code']))
        if len(m_doubles) > 1:
            double_double_issues.append(f"{t['name']} on {d} has {len(m_doubles)} morning doubles: {m_doubles}")

        # Afternoon doubles
        a_doubles = []
        for p in range(5, 8):
            s1 = next((s for s in t_slots if s['period_index'] == p), None)
            s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                a_doubles.append((p, p+1, classes[s1['class_id']]['name'], subjects[s1['subject_id']]['code']))
        if len(a_doubles) > 1:
            double_double_issues.append(f"{t['name']} on {d} has {len(a_doubles)} afternoon doubles: {a_doubles}")

        # Across break
        s3 = next((s for s in t_slots if s['period_index'] == 3), None)
        s4 = next((s for s in t_slots if s['period_index'] == 4), None)
        s5 = next((s for s in t_slots if s['period_index'] == 5), None)
        s6 = next((s for s in t_slots if s['period_index'] == 6), None)
        if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
            s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
            double_double_issues.append(f"{t['name']} on {d} has doubles P3-P4 and P5-P6")

# 5. Adjacent different subjects in same class
for c_id, cls in classes.items():
    for d in DAYS:
        c_slots = sorted([s for s in slts if s['class_id'] == c_id and s['day'] == d], key=lambda x: x['period_index'])
        for i in range(len(c_slots) - 1):
            s1 = c_slots[i]
            s2 = c_slots[i+1]
            if s2['period_index'] == s1['period_index'] + 1 and s1['teacher_id'] == s2['teacher_id'] and s1['subject_id'] != s2['subject_id']:
                adjacent_issues.append(f"Adjacent diff subjects in {cls['name']} on {d}: {teachers[s1['teacher_id']]['name']} ({subjects[s1['subject_id']]['code']} P{s1['period_index']} -> {subjects[s2['subject_id']]['code']} P{s2['period_index']})")

print(f"\nHard issues ({len(hard_issues)}):")
for h in hard_issues:
    print(f"  * {h}")

print(f"\nPeriod 8 issues ({len(p8_issues)}):")
for p in p8_issues:
    print(f"  * {p}")

print(f"\nDouble-double issues ({len(double_double_issues)}):")
for dd in double_double_issues:
    print(f"  * {dd}")

print(f"\nAdjacent different subject issues ({len(adjacent_issues)}):")
for adj in adjacent_issues:
    print(f"  * {adj}")
