import json, sqlite3

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM classes')}
teachers = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: row[1] for row in cursor.execute('SELECT id, code FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

for c_name in ['SS 1', 'SS 3']:
    cid = next(i for i, name in classes.items() if name == c_name)
    print(f"\n==================== {c_name} ====================")
    for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
        d_slts = sorted([s for s in slts if s['class_id'] == cid and s['day'] == d], key=lambda x: x['period_index'])
        print(f"--- {d} ---")
        for s in d_slts:
            print(f"  P{s['period_index']}: {subjects[s['subject_id']]} ({teachers[s['teacher_id']]})")
