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

# Import evaluate from test_further_cleanup
from test_further_cleanup import evaluate, get_class_units

tot, h, s, p8, dd, adj, issues = evaluate(slots)
print(f"Current State: Hard={h}, P8={p8}, DD={dd}, Adj={adj}")
for iss in issues:
    print(f"  * {iss}")

# Search across ALL classes for pairs of unit moves that yield Adj < 2
print("\nSearching 2-move sequences across all classes...")
all_units = []
for c_id in classes.keys():
    c_units = get_class_units(slots, c_id)
    for u in c_units:
        u['class_id'] = c_id
        all_units.append(u)

# Filter to units in SS classes
ss_units = [u for u in all_units if not classes[u['class_id']]['name'].startswith('JS')]

found = False
for i in range(len(ss_units)):
    for j in range(i + 1, len(ss_units)):
        uA, uB = ss_units[i], ss_units[j]
        if uA['class_id'] != uB['class_id']:
            continue
        if uA['type'] != uB['type']:
            continue
        dA, pA = uA['day'], uA['periods']
        dB, pB = uB['day'], uB['periods']

        revert1 = []
        for slt in uA['slots']:
            offset = slt['period_index'] - pA[0]
            revert1.append((slt, slt['day'], slt['period_index']))
            slt['day'], slt['period_index'] = dB, pB[0] + offset
        for slt in uB['slots']:
            offset = slt['period_index'] - pB[0]
            revert1.append((slt, slt['day'], slt['period_index']))
            slt['day'], slt['period_index'] = dA, pA[0] + offset

        # Now test second move in any SS class
        for k in range(len(ss_units)):
            for l in range(k + 1, len(ss_units)):
                uC, uD = ss_units[k], ss_units[l]
                if uC['class_id'] != uD['class_id']:
                    continue
                if uC['type'] != uD['type']:
                    continue
                dC, pC = uC['day'], uC['periods']
                dD, pD = uD['day'], uD['periods']

                revert2 = []
                for slt in uC['slots']:
                    offset = slt['period_index'] - pC[0]
                    revert2.append((slt, slt['day'], slt['period_index']))
                    slt['day'], slt['period_index'] = dD, pD[0] + offset
                for slt in uD['slots']:
                    offset = slt['period_index'] - pD[0]
                    revert2.append((slt, slt['day'], slt['period_index']))
                    slt['day'], slt['period_index'] = dC, pC[0] + offset

                tot2, h2, s2, p8_2, dd2, adj2, iss2 = evaluate(slots)
                if h2 == 0 and p8_2 == 0 and adj2 == 0:
                    c1 = classes[uA['class_id']]['name']
                    c2 = classes[uC['class_id']]['name']
                    print(f"🎉 FOUND 2-MOVE SOLUTION FOR ZERO ADJACENT ISSUES!")
                    print(f"  Move 1 ({c1}): {dA} P{pA} <-> {dB} P{pB}")
                    print(f"  Move 2 ({c2}): {dC} P{pC} <-> {dD} P{pD}")
                    print(f"  Result: Hard={h2}, P8={p8_2}, DD={dd2}, Adj={adj2}, Score={tot2}")
                    found = True
                    break
                else:
                    for slt, d_orig, p_orig in revert2:
                        slt['day'] = d_orig
                        slt['period_index'] = p_orig
            if found:
                break

        if found:
            break
        else:
            for slt, d_orig, p_orig in revert1:
                slt['day'] = d_orig
                slt['period_index'] = p_orig
    if found:
        break

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
