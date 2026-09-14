import json, sqlite3

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: {'id': row[0], 'name': row[1], 'level': row[2]} for row in cursor.execute('SELECT id, name, level FROM classes')}
teachers = {row[0]: {'id': row[0], 'name': row[1]} for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: {'id': row[0], 'code': row[1], 'name': row[2]} for row in cursor.execute('SELECT id, code, name FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slots = json.load(f)

from test_exact_pair import evaluate

ss1_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 1')
ss3_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 3')

# Swap Wednesday P8 slots between SS 1 and SS 3
s1_p8 = next(s for s in slots if s['class_id'] == ss1_id and s['day'] == 'Wednesday' and s['period_index'] == 8)
s3_p8 = next(s for s in slots if s['class_id'] == ss3_id and s['day'] == 'Wednesday' and s['period_index'] == 8)

s1_p8['class_id'] = ss3_id
s3_p8['class_id'] = ss1_id

tot, h, s, p8, dd, adj, issues = evaluate(slots)
print(f"Result after Wednesday P8 cross-class swap:")
print(f"  Hard={h}, Soft={s}, P8_diff={p8}, DD={dd}, Adj={adj}")
for iss in issues:
    print(f"  * {iss}")

with open('server/data/solved_246_slots.json', 'w', encoding='utf-8') as f:
    json.dump(slots, f, indent=2)
print("Saved to server/data/solved_246_slots.json")

cursor.execute("DELETE FROM timetable_slots")
for s in slots:
    cursor.execute("""
        INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (s['class_id'], s['subject_id'], s['teacher_id'], s['day'], s['period_index'], s.get('is_locked', 0)))
conn.commit()
print("Committed to SQLite!")
