import json
import sqlite3
from collections import defaultdict

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()

classes = {row[0]: {'id': row[0], 'name': row[1], 'level': row[2]} for row in cursor.execute('SELECT id, name, level FROM classes')}
teachers = {row[0]: {'id': row[0], 'name': row[1]} for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: {'id': row[0], 'code': row[1], 'name': row[2]} for row in cursor.execute('SELECT id, code, name FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

def print_day_class(c_name, day):
    c_id = next(cid for cid, c in classes.items() if c['name'] == c_name)
    c_slots = sorted([s for s in slts if s['class_id'] == c_id and s['day'] == day], key=lambda x: x['period_index'])
    print(f"\n--- {c_name} on {day} ---")
    for s in c_slots:
        print(f"P{s['period_index']}: {subjects[s['subject_id']]['code']} ({teachers[s['teacher_id']]['name']})")

# 1. JS 1 on Thursday: Maryam IRS P3 -> NV P4
print_day_class('JS 1', 'Thursday')

# 2. JS 3 on Thursday: Zainab ENG P5 -> BUS P6
print_day_class('JS 3', 'Thursday')

# 3. SS 2 on Wednesday: Amina AGR P3 -> BIO P4
print_day_class('SS 2', 'Wednesday')

# 4. JS 2 on Tuesday: Nabila HAUSA P6, Maryam NV P7, Nabila IRS P8
print_day_class('JS 2', 'Tuesday')

# 5. JS 1 on Tuesday
print_day_class('JS 1', 'Tuesday')
