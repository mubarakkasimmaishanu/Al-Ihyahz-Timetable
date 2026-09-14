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

from test_further_cleanup import evaluate

tot, h, s, p8, dd, adj, issues = evaluate(slots)
print(f"Current State: Hard={h}, P8={p8}, DD={dd}, Adj={adj}")
for iss in issues:
    print(f"  * {iss}")

ss1_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 1')
ss3_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 3')
bio_id = next(sid for sid, s in subjects.items() if s['code'] == 'BIO')
lit_id = next(sid for sid, s in subjects.items() if s['code'] == 'LIT')
civ_id = next(sid for sid, s in subjects.items() if s['code'] == 'CIV')

# Find SS 1 Thu P7 BIO/LIT and SS 3 Thu P7 CIV
# Find SS 3 Wed P7 BIO/LIT and SS 1 Thu P8 CIV or similar
print("\nSearching cross-class elective shifts between SS 1 and SS 3...")

# Let's test swapping SS 1 Thu P7 (BIO/LIT) with SS 3 Thu P7 (CIV)
# If we do that, in SS 1 Thu P7 is CIV (Abba), in SS 3 Thu P7 is BIO/LIT (Amina/Hassan)
# But SS 1 needs 4 contacts of BIO/LIT and SS 3 needs 4 contacts of BIO/LIT
# So SS 1 gave a BIO/LIT to SS 3, meaning SS 3 must give a BIO/LIT back to SS 1!
# SS 3 gives its Wednesday P7 BIO/LIT to SS 1!
# And SS 1 gives its Thursday P8 CIV (or another slot) back to SS 3!

# Let's search all 4-tuples:
# s1_biolit in SS 1
# s1_other in SS 1
# s3_biolit in SS 3
# s3_other in SS 3
ss1_biolit_slots = [s for s in slots if s['class_id'] == ss1_id and s['subject_id'] in (bio_id, lit_id)]
ss3_biolit_slots = [s for s in slots if s['class_id'] == ss3_id and s['subject_id'] in (bio_id, lit_id)]

# We only consider single BIO/LIT periods
# Group by (day, period_index)
ss1_biolit_singles = []
by_dp1 = defaultdict(list)
for s in ss1_biolit_slots:
    by_dp1[(s['day'], s['period_index'])].append(s)
for dp, slt_list in by_dp1.items():
    if len(slt_list) == 2: # single paired elective
        ss1_biolit_singles.append((dp, slt_list))

ss3_biolit_singles = []
by_dp3 = defaultdict(list)
for s in ss3_biolit_slots:
    by_dp3[(s['day'], s['period_index'])].append(s)
for dp, slt_list in by_dp3.items():
    if len(slt_list) == 2:
        ss3_biolit_singles.append((dp, slt_list))

print(f"SS 1 BIO/LIT singles: {[x[0] for x in ss1_biolit_singles]}")
print(f"SS 3 BIO/LIT singles: {[x[0] for x in ss3_biolit_singles]}")

ss1_other_singles = [s for s in slots if s['class_id'] == ss1_id and s['period_index'] != 8 and (s['day'], s['period_index']) not in by_dp1]
ss3_other_singles = [s for s in slots if s['class_id'] == ss3_id and s['period_index'] != 8 and (s['day'], s['period_index']) not in by_dp3]

found = False
for dp1, bl1 in ss1_biolit_singles:
    for dp3, bl3 in ss3_biolit_singles:
        for s1_oth in ss1_other_singles:
            for s3_oth in ss3_other_singles:
                # Test:
                # bl1 in SS 1 moves to s3_oth's (day, period) in SS 3
                # bl3 in SS 3 moves to s1_oth's (day, period) in SS 1
                # s3_oth in SS 3 moves to dp3 in SS 3
                # s1_oth in SS 1 moves to dp1 in SS 1
                # Only if s3_oth's day, period matches dp1 or something, or direct slot swap!
                pass

# Let's test direct swaps in SS 1 and SS 3 where each moves their BIO/LIT single:
for dp1, bl1 in ss1_biolit_singles:
    for s1_cand in [s for s in slots if s['class_id'] == ss1_id and s['period_index'] not in (1, 8)]:
        # Swap bl1 with s1_cand in SS 1
        d_cand1, p_cand1 = s1_cand['day'], s1_cand['period_index']
        d_bl1, p_bl1 = dp1
        for s in bl1:
            s['day'], s['period_index'] = d_cand1, p_cand1
        s1_cand['day'], s1_cand['period_index'] = d_bl1, p_bl1

        for dp3, bl3 in ss3_biolit_singles:
            for s3_cand in [s for s in slots if s['class_id'] == ss3_id and s['period_index'] not in (1, 8)]:
                d_cand3, p_cand3 = s3_cand['day'], s3_cand['period_index']
                d_bl3, p_bl3 = dp3
                for s in bl3:
                    s['day'], s['period_index'] = d_cand3, p_cand3
                s3_cand['day'], s3_cand['period_index'] = d_bl3, p_bl3

                tot2, h2, s2, p8_2, dd2, adj2, iss2 = evaluate(slots)
                if h2 == 0 and p8_2 == 0 and adj2 == 0:
                    print(f"🎉 PERFECT MATCH FOUND!")
                    print(f"  SS 1: {d_bl1} P{p_bl1} (BIO/LIT) <-> {d_cand1} P{p_cand1} ({subjects[s1_cand['subject_id']]['code']})")
                    print(f"  SS 3: {d_bl3} P{p_bl3} (BIO/LIT) <-> {d_cand3} P{p_cand3} ({subjects[s3_cand['subject_id']]['code']})")
                    print(f"  Result: Hard={h2}, P8={p8_2}, DD={dd2}, Adj={adj2}, Score={tot2}")
                    found = True
                    break
                else:
                    for s in bl3:
                        s['day'], s['period_index'] = d_bl3, p_bl3
                    s3_cand['day'], s3_cand['period_index'] = d_cand3, p_cand3
            if found: break

        if found: break
        else:
            for s in bl1:
                s['day'], s['period_index'] = d_bl1, p_bl1
            s1_cand['day'], s1_cand['period_index'] = d_cand1, p_cand1
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
