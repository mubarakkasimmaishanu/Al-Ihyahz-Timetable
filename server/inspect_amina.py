import json, sqlite3

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM classes')}
teachers = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: row[1] for row in cursor.execute('SELECT id, code FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

amina_id = next(tid for tid, name in teachers.items() if 'Amina' in name)
amina_slots = [s for s in slts if s['teacher_id'] == amina_id]
print("=== M. AMINA ALL SLOTS ===")
for s in sorted(amina_slots, key=lambda x: (x['class_id'], x['day'], x['period_index'])):
    print(f"{classes[s['class_id']].ljust(5)} {subjects[s['subject_id']].ljust(4)}: {s['day'].ljust(9)} P{s['period_index']}")
