import json
import sqlite3
import copy
from collections import defaultdict
import random
import time
import math

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

# Apply confirmed clean moves:
# 1. JS 3 Thu P6 BUS <-> P7 HAUSA
js3_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 3')
bus_id = next(sid for sid, s in subjects.items() if s['code'] == 'BUS')
hausa_id = next(sid for sid, s in subjects.items() if s['code'] == 'HAUSA')
s_bus = next(s for s in slots if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 6 and s['subject_id'] == bus_id)
s_hausa = next(s for s in slots if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 7 and s['subject_id'] == hausa_id)
s_bus['period_index'] = 7
s_hausa['period_index'] = 6

# 2. JS 1 Thu P4 NV <-> Mon P6 IRS
js1_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 1')
nv_id = next(sid for sid, s in subjects.items() if s['code'] == 'NV')
irs_id = next(sid for sid, s in subjects.items() if s['code'] == 'IRS')
s_nv_thu = next(s for s in slots if s['class_id'] == js1_id and s['day'] == 'Thursday' and s['period_index'] == 4 and s['subject_id'] == nv_id)
s_irs_mon = next(s for s in slots if s['class_id'] == js1_id and s['day'] == 'Monday' and s['period_index'] == 6 and s['subject_id'] == irs_id)
s_nv_thu['day'], s_irs_mon['day'] = s_irs_mon['day'], s_nv_thu['day']
s_nv_thu['period_index'], s_irs_mon['period_index'] = s_irs_mon['period_index'], s_nv_thu['period_index']

# 3. JS 1 Tue P7 CMP <-> P8 BUS
s_cmp_tue = next(s for s in slots if s['class_id'] == js1_id and s['day'] == 'Tuesday' and s['period_index'] == 7)
s_bus_tue = next(s for s in slots if s['class_id'] == js1_id and s['day'] == 'Tuesday' and s['period_index'] == 8)
s_cmp_tue['period_index'] = 8
s_bus_tue['period_index'] = 7

# 4. JS 2 Tue P4 BUS <-> P8 IRS
js2_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 2')
s_bus_js2 = next(s for s in slots if s['class_id'] == js2_id and s['day'] == 'Tuesday' and s['period_index'] == 4)
s_irs_js2 = next(s for s in slots if s['class_id'] == js2_id and s['day'] == 'Tuesday' and s['period_index'] == 8)
s_bus_js2['period_index'] = 8
s_irs_js2['period_index'] = 4

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
            soft_penalty += diff * 10000 # Strict P8 equality

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

# Identify units in each class
def get_class_units(slts, c_id):
    c_slots = [s for s in slts if s['class_id'] == c_id]
    by_day = defaultdict(list)
    for s in c_slots:
        by_day[s['day']].append(s)
    
    units = []
    for d, d_slts in by_day.items():
        # group by period
        by_p = defaultdict(list)
        for s in d_slts:
            by_p[s['period_index']].append(s)
        
        visited_p = set()
        for p in sorted(by_p.keys()):
            if p in visited_p:
                continue
            # check if p and p+1 form a double of same subject(s)
            p_next = p + 1
            is_double = False
            if p_next in by_p and p != 4: # never across break
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
best_slots = copy.deepcopy(slots)
cur_tot, cur_h, cur_s, cur_p8, cur_dd, cur_adj = fast_eval(cur_slots)
best_tot = cur_tot

print(f"Starting Annealer: Score={cur_tot} (Hard={cur_h}, Soft={cur_s}, P8_diff={cur_p8}, DD={cur_dd}, Adj={cur_adj})")

# Simulated Annealing
random.seed(42)
T = 50.0
alpha = 0.9999
start_time = time.time()

for it in range(1, 100001):
    c_id = random.choice(list(classes.keys()))
    units = get_class_units(cur_slots, c_id)
    
    # Choose move type:
    # 80% same size unit swap
    # 20% double with two adjacent singles
    u_singles = [u for u in units if u['type'] == 'single']
    u_doubles = [u for u in units if u['type'] == 'double']

    move_done = False
    revert_data = []

    if random.random() < 0.85:
        # Swap same size units
        if random.random() < 0.6 and len(u_singles) >= 2:
            uA, uB = random.sample(u_singles, 2)
            if uA['day'] == uB['day'] and uA['periods'] == uB['periods']:
                continue
            dA, pA = uA['day'], uA['periods'][0]
            dB, pB = uB['day'], uB['periods'][0]

            for s in uA['slots']:
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dB, pB
            for s in uB['slots']:
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dA, pA
            move_done = True
        elif len(u_doubles) >= 2:
            uA, uB = random.sample(u_doubles, 2)
            if uA['day'] == uB['day'] and uA['periods'] == uB['periods']:
                continue
            dA, pA = uA['day'], uA['periods']
            dB, pB = uB['day'], uB['periods']

            for s in uA['slots']:
                offset = s['period_index'] - pA[0]
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dB, pB[0] + offset
            for s in uB['slots']:
                offset = s['period_index'] - pB[0]
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = dA, pA[0] + offset
            move_done = True
    else:
        # Swap a double with two consecutive singles
        # Find pairs of singles on same day with p2 == p1 + 1 (not crossing break)
        singles_by_day = defaultdict(list)
        for u in u_singles:
            singles_by_day[u['day']].append(u)
        
        pair_cands = []
        for d, s_list in singles_by_day.items():
            s_list.sort(key=lambda x: x['periods'][0])
            for i in range(len(s_list) - 1):
                p1 = s_list[i]['periods'][0]
                p2 = s_list[i+1]['periods'][0]
                if p2 == p1 + 1 and p1 != 4:
                    pair_cands.append((s_list[i], s_list[i+1]))
        
        if pair_cands and u_doubles:
            pair = random.choice(pair_cands)
            uD = random.choice(u_doubles)
            uS1, uS2 = pair
            d_pair = uS1['day']
            p_pair = [uS1['periods'][0], uS2['periods'][0]]
            d_dbl = uD['day']
            p_dbl = uD['periods']

            if d_pair == d_dbl and p_pair == p_dbl:
                continue

            # Move uD to p_pair
            for s in uD['slots']:
                offset = s['period_index'] - p_dbl[0]
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = d_pair, p_pair[0] + offset
            
            # Move uS1 to p_dbl[0]
            for s in uS1['slots']:
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = d_dbl, p_dbl[0]
            
            # Move uS2 to p_dbl[1]
            for s in uS2['slots']:
                revert_data.append((s, s['day'], s['period_index']))
                s['day'], s['period_index'] = d_dbl, p_dbl[1]
            
            move_done = True

    if not move_done:
        continue

    tot, h, s, p8, dd, adj = fast_eval(cur_slots)

    # We strictly enforce h == 0 and p8 == 0
    accept = False
    if h == 0 and p8 == 0:
        if tot < cur_tot:
            accept = True
        elif math.exp(-(tot - cur_tot) / max(0.1, T)) > random.random():
            accept = True

    if accept:
        cur_tot = tot
        if tot < best_tot:
            best_tot = tot
            best_slots = copy.deepcopy(cur_slots)
            print(f"[Iter {it}] NEW BEST: Score={best_tot} (DD={dd}, Adj={adj}) in {time.time()-start_time:.1f}s")
            if best_tot == 0 or (dd == 0 and adj == 0):
                print("🎉 PERFECT SCHEDULE FOUND WITH 0 HARD, 0 P8-DIFF, 0 DD, 0 ADJ!")
                break
    else:
        # Revert
        for s, d_orig, p_orig in revert_data:
            s['day'] = d_orig
            s['period_index'] = p_orig

    T *= alpha

final_tot, final_h, final_s, final_p8, final_dd, final_adj = fast_eval(best_slots)
print(f"\nFinal Annealer Result: Score={final_tot} (Hard={final_h}, Soft={final_s}, P8_diff={final_p8}, DD={final_dd}, Adj={final_adj})")

if final_tot < cur_tot or (final_h == 0 and final_p8 == 0):
    with open('server/data/solved_246_slots.json', 'w', encoding='utf-8') as f:
        json.dump(best_slots, f, indent=2)
    print("Saved optimized timetable to server/data/solved_246_slots.json")

    # Update SQLite database
    cursor.execute("DELETE FROM timetable_slots")
    for s in best_slots:
        cursor.execute("""
            INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (s['class_id'], s['subject_id'], s['teacher_id'], s['day'], s['period_index'], s.get('is_locked', 0)))
    conn.commit()
    print("Successfully committed to SQLite timetable_slots table!")
