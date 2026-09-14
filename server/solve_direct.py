import json
import sqlite3
from collections import defaultdict

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()

classes = {row[0]: {'id': row[0], 'name': row[1], 'level': row[2]} for row in cursor.execute('SELECT id, name, level FROM classes')}
teachers = {row[0]: {'id': row[0], 'name': row[1]} for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: {'id': row[0], 'code': row[1], 'name': row[2]} for row in cursor.execute('SELECT id, code, name FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slots = json.load(f)

# Print M. Shehu's complete schedule
shehu_id = next(t_id for t_id, t in teachers.items() if 'Shehu' in t['name'])
shehu_slots = [s for s in slots if s['teacher_id'] == shehu_id]
print("=== M. SHEHU SCHEDULE ===")
for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    d_slts = sorted([s for s in shehu_slots if s['day'] == d], key=lambda x: x['period_index'])
    print(f"{d}: " + ", ".join(f"P{s['period_index']} {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}" for s in d_slts))

# Print M. Nana Firdaus's schedule on Thursday
nana_id = next(t_id for t_id, t in teachers.items() if 'Nana' in t['name'])
nana_slots = [s for s in slots if s['teacher_id'] == nana_id]
print("\n=== M. NANA FIRDAUS SCHEDULE ===")
for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    d_slts = sorted([s for s in nana_slots if s['day'] == d], key=lambda x: x['period_index'])
    print(f"{d}: " + ", ".join(f"P{s['period_index']} {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}" for s in d_slts))

# Print M. Zainab Kabir's schedule on Thursday
zainab_id = next(t_id for t_id, t in teachers.items() if 'Zainab' in t['name'])
zainab_slots = [s for s in slots if s['teacher_id'] == zainab_id]
print("\n=== M. ZAINAB KABIR SCHEDULE ===")
for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    d_slts = sorted([s for s in zainab_slots if s['day'] == d], key=lambda x: x['period_index'])
    print(f"{d}: " + ", ".join(f"P{s['period_index']} {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}" for s in d_slts))

# Print M. Amina's schedule on Tuesday
amina_id = next(t_id for t_id, t in teachers.items() if 'Amina' in t['name'])
amina_slots = [s for s in slots if s['teacher_id'] == amina_id]
print("\n=== M. AMINA SCHEDULE ===")
for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    d_slts = sorted([s for s in amina_slots if s['day'] == d], key=lambda x: x['period_index'])
    print(f"{d}: " + ", ".join(f"P{s['period_index']} {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}" for s in d_slts))
