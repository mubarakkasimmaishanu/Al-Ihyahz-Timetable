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

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

print("================ TEACHER DAILY SCHEDULES ================")
for t_id, t in sorted(teachers.items(), key=lambda x: x[1]['name']):
    t_name = t['name']
    print(f"\n*** {t_name} ***")
    for d in DAYS:
        day_slots = sorted([s for s in slts if s['teacher_id'] == t_id and s['day'] == d], key=lambda x: x['period_index'])
        periods_str = []
        for p in range(1, 9 if d != 'Friday' else 7):
            s = next((s for s in day_slots if s['period_index'] == p), None)
            if s:
                periods_str.append(f"P{p}:{classes[s['class_id']]['name']}_{subjects[s['subject_id']]['code']}")
            else:
                periods_str.append(f"P{p}:---")
        print(f"  {d.ljust(9)}: {' '.join(periods_str)}")
