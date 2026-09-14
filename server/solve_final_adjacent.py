import json, sqlite3, copy
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
    slots = json.load(f)

from test_further_cleanup import evaluate, get_class_units

tot, h, s, p8, dd, adj, issues = evaluate(slots)
print(f"Current State: Hard={h}, P8={p8}, DD={dd}, Adj={adj}")
for iss in issues:
    print(f"  * {iss}")

ss1_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 1')
ss2_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 2')
ss3_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 3')

# Test same-time cross-class swaps across ALL senior classes
print("\nTesting same-time cross-class swaps among (SS 1, SS 2, SS 3)...")
senior_ids = [ss1_id, ss2_id, ss3_id]
found = False

for d in DAYS:
    for p in range(1, 9):
        for idx1 in range(len(senior_ids)):
            for idx2 in range(idx1 + 1, len(senior_ids)):
                c1_id, c2_id = senior_ids[idx1], senior_ids[idx2]
                s1_slots = [s for s in slots if s['class_id'] == c1_id and s['day'] == d and s['period_index'] == p]
                s2_slots = [s for s in slots if s['class_id'] == c2_id and s['day'] == d and s['period_index'] == p]
                if not s1_slots or not s2_slots:
                    continue
                if len(s1_slots) != len(s2_slots):
                    continue

                for s in s1_slots:
                    s['class_id'] = c2_id
                for s in s2_slots:
                    s['class_id'] = c1_id

                tot2, h2, s2, p8_2, dd2, adj2, iss2 = evaluate(slots)
                if h2 == 0 and p8_2 == 0 and adj2 == 0:
                    c1_name = classes[c1_id]['name']
                    c2_name = classes[c2_id]['name']
                    sub1 = "/".join(subjects[x['subject_id']]['code'] for x in s1_slots)
                    sub2 = "/".join(subjects[x['subject_id']]['code'] for x in s2_slots)
                    print(f"🎉 ZERO ADJACENT FOUND! Swap {c1_name} ({sub1}) <-> {c2_name} ({sub2}) on {d} P{p} => Score={tot2}")
                    found = True
                    break
                else:
                    for s in s1_slots:
                        s['class_id'] = c1_id
                    for s in s2_slots:
                        s['class_id'] = c2_id
            if found: break
        if found: break
    if found: break

if found:
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
