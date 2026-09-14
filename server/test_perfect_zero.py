import json, sqlite3, copy
from collections import defaultdict

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: {'id': row[0], 'name': row[1], 'level': row[2]} for row in cursor.execute('SELECT id, name, level FROM classes')}
teachers = {row[0]: {'id': row[0], 'name': row[1]} for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: {'id': row[0], 'code': row[1], 'name': row[2]} for row in cursor.execute('SELECT id, code, name FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slots = json.load(f)

from test_exact_pair import evaluate

# Let's search in SS 1 for any 3-unit rotation or 2-unit swap that eliminates M. Hassan adjacent on Thursday:
# SS 1 Thu P7 is BIO/LIT (paired single)
# SS 1 Thu P6 is GOV/PHY (paired single)
# Candidate single slots in SS 1 across all days:
ss1_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 1')

# Group SS 1 slots by (day, period_index)
ss1_by_dp = defaultdict(list)
for s in slots:
    if s['class_id'] == ss1_id:
        ss1_by_dp[(s['day'], s['period_index'])].append(s)

# Units in SS 1:
# A double is (dp1, dp2) where both have same subject
# A single is dp
doubles_dp = set()
for (d, p), slt_list in list(ss1_by_dp.items()):
    p_next = p + 1
    if (d, p_next) in ss1_by_dp and p != 4:
        s1_sub = set(s['subject_id'] for s in slt_list)
        s2_sub = set(s['subject_id'] for s in ss1_by_dp[(d, p_next)])
        if s1_sub == s2_sub:
            doubles_dp.add((d, p))
            doubles_dp.add((d, p_next))

single_dps = [dp for dp in ss1_by_dp.keys() if dp not in doubles_dp]
print(f"SS 1 has {len(single_dps)} single period units: {single_dps}")

# Test all 3-way rotations of single units in SS 1
found = False
for i in range(len(single_dps)):
    for j in range(len(single_dps)):
        if j == i: continue
        for k in range(len(single_dps)):
            if k in (i, j): continue
            dpA, dpB, dpC = single_dps[i], single_dps[j], single_dps[k]
            # One of them should be ('Thursday', 6) or ('Thursday', 7)
            if ('Thursday', 6) not in (dpA, dpB, dpC) and ('Thursday', 7) not in (dpA, dpB, dpC):
                continue

            # Rotate: dpA -> dpB, dpB -> dpC, dpC -> dpA
            sltsA = ss1_by_dp[dpA]
            sltsB = ss1_by_dp[dpB]
            sltsC = ss1_by_dp[dpC]

            revert = []
            for s in sltsA:
                revert.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dpB
            for s in sltsB:
                revert.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dpC
            for s in sltsC:
                revert.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dpA

            tot, h, s_pen, p8, dd, adj, iss = evaluate(slots)
            if h == 0 and p8 == 0 and adj == 0:
                print(f"🎉🎉🎉 ABSOLUTE PERFECTION FOUND! 🎉🎉🎉")
                print(f"  3-way rotation in SS 1: {dpA} -> {dpB} -> {dpC} -> {dpA}")
                print(f"  Hard={h}, P8_diff={p8}, Adj={adj}, DD={dd}, Score={tot}")
                found = True
                break
            else:
                for s, d_orig, p_orig in revert:
                    s['day'] = d_orig
                    s['period_index'] = p_orig
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
