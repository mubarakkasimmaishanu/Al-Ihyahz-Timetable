import json, sqlite3
from collections import defaultdict

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM classes')}
teachers = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: row[1] for row in cursor.execute('SELECT id, code FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

for target in ['Nana Firdaus', 'Hassan', 'Amina', 'Zainab Kabir', 'Sumayya']:
    tid = next(i for i, name in teachers.items() if target in name)
    print(f"\n==================== M. {target} ====================")
    for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
        d_slts = sorted([s for s in slts if s['teacher_id'] == tid and s['day'] == d], key=lambda x: x['period_index'])
        print(f"{d.ljust(9)}: " + ", ".join(f"P{s['period_index']} {classes[s['class_id']]} {subjects[s['subject_id']]}" for s in d_slts))
