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

# 1. Inspect M. Nabila & M. Sumayya
print("=== M. NABILA SLOTS ===")
nabila_id = next(tid for tid, t in teachers.items() if 'Nabila' in t['name'])
for s in sorted([s for s in slts if s['teacher_id'] == nabila_id], key=lambda x: (x['day'], x['period_index'])):
    print(f"{s['day']} P{s['period_index']}: {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}")

print("\n=== M. SUMAYYA SLOTS ===")
sumayya_id = next(tid for tid, t in teachers.items() if 'Sumayya' in t['name'])
for s in sorted([s for s in slts if s['teacher_id'] == sumayya_id], key=lambda x: (x['day'], x['period_index'])):
    print(f"{s['day']} P{s['period_index']}: {classes[s['class_id']]['name']} {subjects[s['subject_id']]['code']}")

print("\n=== JS 2 TUESDAY SLOTS ===")
js2_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 2')
for s in sorted([s for s in slts if s['class_id'] == js2_id and s['day'] == 'Tuesday'], key=lambda x: x['period_index']):
    print(f"P{s['period_index']}: {subjects[s['subject_id']]['code']} ({teachers[s['teacher_id']]['name']})")

print("\n=== JS 1 THURSDAY SLOTS ===")
js1_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 1')
for s in sorted([s for s in slts if s['class_id'] == js1_id and s['day'] == 'Thursday'], key=lambda x: x['period_index']):
    print(f"P{s['period_index']}: {subjects[s['subject_id']]['code']} ({teachers[s['teacher_id']]['name']})")

print("\n=== JS 3 THURSDAY SLOTS ===")
js3_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 3')
for s in sorted([s for s in slts if s['class_id'] == js3_id and s['day'] == 'Thursday'], key=lambda x: x['period_index']):
    print(f"P{s['period_index']}: {subjects[s['subject_id']]['code']} ({teachers[s['teacher_id']]['name']})")

print("\n=== SS 2 WEDNESDAY SLOTS ===")
ss2_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 2')
for s in sorted([s for s in slts if s['class_id'] == ss2_id and s['day'] == 'Wednesday'], key=lambda x: x['period_index']):
    print(f"P{s['period_index']}: {subjects[s['subject_id']]['code']} ({teachers[s['teacher_id']]['name']})")
