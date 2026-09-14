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

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slots = json.load(f)

# Re-implement fast evaluate
def evaluate(slts):
    hard_penalty = 0
    soft_penalty = 0
    issues = []

    t_counts = {}
    p8_counts = defaultdict(int)
    for s in slts:
        t_id = s['teacher_id']
        day = s['day']
        p = s['period_index']
        key = (t_id, day, p)
        c = t_counts.get(key, 0) + 1
        t_counts[key] = c
        if c > 1:
            hard_penalty += 100000
            t_name = teachers[t_id]['name']
            issues.append(f"Teacher {t_name} clash at {day} P{p}")

        if p == 8:
            p8_counts[t_id] += 1

        c_name = classes[s['class_id']]['name']
        is_jun = c_name.startswith('JS')
        t_name = teachers[t_id]['name']

        if (day == 'Monday' or day == 'Friday') and p == 1:
            hard_penalty += 100000
            issues.append(f"Assembly clash {day} P1")
        if day == 'Friday':
            if is_jun and p > 4:
                hard_penalty += 100000
                issues.append(f"Junior Friday after P4 {c_name} P{p}")
            if not is_jun and p > 6:
                hard_penalty += 100000
                issues.append(f"Senior Friday after P6 {c_name} P{p}")
            if 'Shehu' in t_name or 'Zainab' in t_name:
                hard_penalty += 100000
                issues.append(f"{t_name} on Friday")
        if 'Shehu' in t_name and p > 6:
            hard_penalty += 100000
            issues.append(f"M. Shehu after P6")

        code = subjects[s['subject_id']]['code']
        if code == 'MTH':
            if day != 'Friday' and p >= 7:
                hard_penalty += 50000
                issues.append(f"Math tired hours {day} P{p}")
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
                issues.append(f"Math Friday tired hours P{p}")
        elif code == 'ENG':
            if day != 'Friday' and p >= 8:
                hard_penalty += 50000
                issues.append(f"English P8 {day} P{p}")
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
                issues.append(f"English Friday tired hours P{p}")
        elif code == 'CHM' and p == 8:
            hard_penalty += 50000
            issues.append(f"Chemistry in P8")

    class_time = defaultdict(list)
    for s in slts:
        class_time[(s['class_id'], s['day'], s['period_index'])].append(s['subject_id'])
    
    for key, s_ids in class_time.items():
        if len(s_ids) > 1:
            if len(s_ids) == 2:
                c1 = subjects[s_ids[0]]['code']
                c2 = subjects[s_ids[1]]['code']
                pair = "/".join(sorted([c1, c2]))
                if pair not in ['GOV/PHY', 'CHM/ECO', 'BIO/LIT']:
                    hard_penalty += 100000
                    issues.append(f"Illegal simultaneous pair {pair} at {key}")
            else:
                hard_penalty += 100000
                issues.append(f"Overbooked class at {key}")

    class_day_subs = defaultdict(lambda: defaultdict(list))
    for s in slts:
        class_day_subs[(s['class_id'], s['day'])][s['subject_id']].append(s['period_index'])
    
    for (c_id, d), sub_dict in class_day_subs.items():
        for s_id, periods in sub_dict.items():
            if len(periods) > 2:
                hard_penalty += 50000
                issues.append(f"Subject {subjects[s_id]['code']} > 2 times on {d}")
            elif len(periods) == 2:
                if abs(periods[0] - periods[1]) != 1:
                    hard_penalty += 50000
                    issues.append(f"Subject {subjects[s_id]['code']} split on {d}")
                elif min(periods) == 4 and d != 'Friday':
                    hard_penalty += 50000
                    issues.append(f"Subject {subjects[s_id]['code']} double across break on {d}")

    p8_diff = 0
    for t_id, t in teachers.items():
        actual = p8_counts[t_id]
        target = TARGET_P8.get(t['name'], 0)
        if actual != target:
            diff = abs(actual - target)
            p8_diff += diff
            soft_penalty += diff * 10000
            issues.append(f"Period 8: {t['name']} has {actual} (target {target})")

    t_day_slots = defaultdict(list)
    for s in slts:
        t_day_slots[(s['teacher_id'], s['day'])].append(s)
    
    double_double_issues = 0
    for (t_id, d), t_slts in t_day_slots.items():
        m_doubles = 0
        a_doubles = 0
        p_map = {s['period_index']: s for s in t_slts}
        for p in (1, 2, 3):
            s1 = p_map.get(p)
            s2 = p_map.get(p + 1)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                m_doubles += 1
        if m_doubles > 1:
            double_double_issues += (m_doubles - 1)
            soft_penalty += (m_doubles - 1) * 3000
            issues.append(f"{teachers[t_id]['name']} on {d} has {m_doubles} morning doubles")

        for p in (5, 6, 7):
            s1 = p_map.get(p)
            s2 = p_map.get(p + 1)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                a_doubles += 1
        if a_doubles > 1:
            double_double_issues += (a_doubles - 1)
            soft_penalty += (a_doubles - 1) * 3000
            issues.append(f"{teachers[t_id]['name']} on {d} has {a_doubles} afternoon doubles")

        s3 = p_map.get(3)
        s4 = p_map.get(4)
        s5 = p_map.get(5)
        s6 = p_map.get(6)
        if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
            s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
            double_double_issues += 1
            soft_penalty += 3000
            issues.append(f"{teachers[t_id]['name']} on {d} doubles P3-4 and P5-6")

    adj_count = 0
    c_day_slots = defaultdict(list)
    for s in slts:
        c_day_slots[(s['class_id'], s['day'])].append(s)

    for (c_id, d), c_slts in c_day_slots.items():
        p_slots = defaultdict(list)
        for s in c_slts:
            p_slots[s['period_index']].append(s)
        periods = sorted(p_slots.keys())
        for idx in range(len(periods) - 1):
            p1 = periods[idx]
            p2 = periods[idx + 1]
            if p2 == p1 + 1:
                t1 = {s['teacher_id']: s['subject_id'] for s in p_slots[p1]}
                t2 = {s['teacher_id']: s['subject_id'] for s in p_slots[p2]}
                for t in set(t1.keys()).intersection(set(t2.keys())):
                    if t1[t] != t2[t]:
                        adj_count += 1
                        soft_penalty += 4000
                        issues.append(f"Adjacent diff sub in {classes[c_id]['name']} on {d}: {teachers[t]['name']}")

    total = hard_penalty + soft_penalty
    return total, hard_penalty, soft_penalty, p8_diff, double_double_issues, adj_count, issues

ss1_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 1')
ss3_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 3')

# SS 1 Thu P7 is BIO/LIT
# SS 3 Thu P7 is CIV
# SS 1 Thu P8 is CIV
# SS 3 Wed P7 is BIO/LIT
# SS 1 Wed P7 is DPR
# SS 1 Wed P8 is CIV

# Let's test swapping SS 1 Thu P7 (BIO/LIT) with SS 3 Thu P7 (CIV):
# That means in Thu P7: SS 1 has CIV (Abba), SS 3 has BIO/LIT (Amina/Hassan)
# Then in Wed P7: SS 3 has BIO/LIT, what if SS 1 has BIO/LIT and SS 3 has DPR?
# Let's test all direct swaps between SS 1 and SS 3 slots at the same day & period!
print("Testing same (day, period) cross-class swaps between SS 1 and SS 3...")
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
for d in DAYS:
    for p in range(1, 9):
        s1_slots = [s for s in slots if s['class_id'] == ss1_id and s['day'] == d and s['period_index'] == p]
        s3_slots = [s for s in slots if s['class_id'] == ss3_id and s['day'] == d and s['period_index'] == p]
        if not s1_slots or not s3_slots:
            continue
        
        # Only swap if both are single or both are paired single
        if len(s1_slots) != len(s3_slots):
            continue

        # Try swapping class_id
        for s in s1_slots:
            s['class_id'] = ss3_id
        for s in s3_slots:
            s['class_id'] = ss1_id

        tot, h, s, p8, dd, adj, iss = evaluate(slots)
        if h == 0 and p8 == 0 and adj < 2:
            print(f"  FOUND! Same-time swap on {d} P{p} => Adj={adj}, DD={dd}, Score={tot}")

        # Revert
        for s in s1_slots:
            s['class_id'] = ss1_id
        for s in s3_slots:
            s['class_id'] = ss3_id
