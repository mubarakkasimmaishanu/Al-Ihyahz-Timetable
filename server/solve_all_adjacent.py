import json, sqlite3, copy
from collections import defaultdict
import time

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

def fast_eval(slts):
    hard_penalty = 0
    soft_penalty = 0

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

        if p == 8:
            p8_counts[t_id] += 1

        c_name = classes[s['class_id']]['name']
        is_jun = c_name.startswith('JS')
        t_name = teachers[t_id]['name']

        if (day == 'Monday' or day == 'Friday') and p == 1:
            hard_penalty += 100000
        if day == 'Friday':
            if is_jun and p > 4:
                hard_penalty += 100000
            if not is_jun and p > 6:
                hard_penalty += 100000
            if 'Shehu' in t_name or 'Zainab' in t_name:
                hard_penalty += 100000
        if 'Shehu' in t_name and p > 6:
            hard_penalty += 100000

        code = subjects[s['subject_id']]['code']
        if code == 'MTH':
            if day != 'Friday' and p >= 7:
                hard_penalty += 50000
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
        elif code == 'ENG':
            if day != 'Friday' and p >= 8:
                hard_penalty += 50000
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
        elif code == 'CHM' and p == 8:
            hard_penalty += 50000

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
            else:
                hard_penalty += 100000

    class_day_subs = defaultdict(lambda: defaultdict(list))
    for s in slts:
        class_day_subs[(s['class_id'], s['day'])][s['subject_id']].append(s['period_index'])
    
    for (c_id, d), sub_dict in class_day_subs.items():
        for s_id, periods in sub_dict.items():
            if len(periods) > 2:
                hard_penalty += 50000
            elif len(periods) == 2:
                if abs(periods[0] - periods[1]) != 1:
                    hard_penalty += 50000
                elif min(periods) == 4 and d != 'Friday':
                    hard_penalty += 50000

    p8_diff = 0
    for t_id, t in teachers.items():
        actual = p8_counts[t_id]
        target = TARGET_P8.get(t['name'], 0)
        if actual != target:
            diff = abs(actual - target)
            p8_diff += diff
            soft_penalty += diff * 10000

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

        for p in (5, 6, 7):
            s1 = p_map.get(p)
            s2 = p_map.get(p + 1)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                a_doubles += 1
        if a_doubles > 1:
            double_double_issues += (a_doubles - 1)
            soft_penalty += (a_doubles - 1) * 3000

        s3 = p_map.get(3)
        s4 = p_map.get(4)
        s5 = p_map.get(5)
        s6 = p_map.get(6)
        if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
            s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
            double_double_issues += 1
            soft_penalty += 3000

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

    total = hard_penalty + soft_penalty
    return total, hard_penalty, soft_penalty, p8_diff, double_double_issues, adj_count

def get_class_units(slts, c_id):
    c_slots = [s for s in slts if s['class_id'] == c_id]
    by_day = defaultdict(list)
    for s in c_slots:
        by_day[s['day']].append(s)
    
    units = []
    for d, d_slts in by_day.items():
        by_p = defaultdict(list)
        for s in d_slts:
            by_p[s['period_index']].append(s)
        
        visited_p = set()
        for p in sorted(by_p.keys()):
            if p in visited_p:
                continue
            p_next = p + 1
            is_double = False
            if p_next in by_p and p != 4:
                s1_sub = set(s['subject_id'] for s in by_p[p])
                s2_sub = set(s['subject_id'] for s in by_p[p_next])
                if s1_sub == s2_sub:
                    is_double = True
            
            if is_double:
                units.append({
                    'type': 'double',
                    'day': d,
                    'periods': [p, p + 1],
                    'slots': by_p[p] + by_p[p + 1]
                })
                visited_p.add(p)
                visited_p.add(p + 1)
            else:
                units.append({
                    'type': 'single',
                    'day': d,
                    'periods': [p],
                    'slots': by_p[p]
                })
                visited_p.add(p)
    return units

cur_slots = copy.deepcopy(slots)
cur_tot, cur_h, cur_s, cur_p8, cur_dd, cur_adj = fast_eval(cur_slots)
print(f"Initial: Score={cur_tot}, Hard={cur_h}, P8={cur_p8}, DD={cur_dd}, Adj={cur_adj}")

# Search 3-way rotation within each class to eliminate adjacent subjects
found_3way = False
for c_id, c in classes.items():
    c_name = c['name']
    units = get_class_units(cur_slots, c_id)
    u_singles = [u for u in units if u['type'] == 'single']
    
    print(f"Checking 3-way rotations in {c_name} ({len(u_singles)} singles)...", flush=True)
    for i in range(len(u_singles)):
        for j in range(len(u_singles)):
            if j == i: continue
            for k in range(len(u_singles)):
                if k in (i, j): continue
                uA, uB, uC = u_singles[i], u_singles[j], u_singles[k]
                dA, pA = uA['day'], uA['periods'][0]
                dB, pB = uB['day'], uB['periods'][0]
                dC, pC = uC['day'], uC['periods'][0]

                revert = []
                for s in uA['slots']:
                    revert.append((s, s['day'], s['period_index']))
                    s['day'], s['period_index'] = dB, pB
                for s in uB['slots']:
                    revert.append((s, s['day'], s['period_index']))
                    s['day'], s['period_index'] = dC, pC
                for s in uC['slots']:
                    revert.append((s, s['day'], s['period_index']))
                    s['day'], s['period_index'] = dA, pA

                tot, h, s, p8, dd, adj = fast_eval(cur_slots)
                if h == 0 and p8 == 0 and adj < cur_adj:
                    print(f"  [{c_name}] 3-WAY IMPROVEMENT FOUND! A({dA} P{pA}) -> B({dB} P{pB}) -> C({dC} P{pC}) => Adj={adj}, DD={dd}, Score={tot}", flush=True)
                    cur_tot = tot
                    cur_adj = adj
                    cur_dd = dd
                    found_3way = True
                    break
                else:
                    for s, d_orig, p_orig in revert:
                        s['day'] = d_orig
                        s['period_index'] = p_orig
            if found_3way: break
        if found_3way: break

print(f"\nFinal State: Score={cur_tot}, Hard={cur_h}, P8={cur_p8}, DD={cur_dd}, Adj={cur_adj}")
if found_3way:
    with open('server/data/solved_246_slots.json', 'w', encoding='utf-8') as f:
        json.dump(cur_slots, f, indent=2)
    print("Saved to server/data/solved_246_slots.json")
    cursor.execute("DELETE FROM timetable_slots")
    for s in cur_slots:
        cursor.execute("""
            INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (s['class_id'], s['subject_id'], s['teacher_id'], s['day'], s['period_index'], s.get('is_locked', 0)))
    conn.commit()
    print("Committed to SQLite!")
