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
DAY_INDICES = {d: i for i, d in enumerate(DAYS)}

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

# Fast evaluation function
def fast_eval(slts):
    hard_penalty = 0
    soft_penalty = 0

    # 1. Teacher clashes
    # Map: (teacher_id, day, period) -> count
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

        # Assembly & Friday & rules
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

    # Class clashes
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

    # Subject occurrence per day in class
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

    # Period 8 Equality
    p8_diff = 0
    for t_id, t in teachers.items():
        actual = p8_counts[t_id]
        target = TARGET_P8.get(t['name'], 0)
        if actual != target:
            diff = abs(actual - target)
            p8_diff += diff
            soft_penalty += diff * 2000

    # Teacher session doubles
    # Group by (teacher_id, day)
    t_day_slots = defaultdict(list)
    for s in slts:
        t_day_slots[(s['teacher_id'], s['day'])].append(s)
    
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
            soft_penalty += (m_doubles - 1) * 2000

        for p in (5, 6, 7):
            s1 = p_map.get(p)
            s2 = p_map.get(p + 1)
            if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                a_doubles += 1
        if a_doubles > 1:
            soft_penalty += (a_doubles - 1) * 2000

        s3 = p_map.get(3)
        s4 = p_map.get(4)
        s5 = p_map.get(5)
        s6 = p_map.get(6)
        if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
            s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
            soft_penalty += 2000

    # Adjacent different subjects in same class
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
                        soft_penalty += 3000

    total = hard_penalty + soft_penalty
    return total, hard_penalty, soft_penalty, p8_diff, adj_count

t0 = time.time()
for _ in range(100):
    fast_eval(slots)
print(f"100 evaluations took {time.time() - t0:.2f}s ({(time.time() - t0)/100*1000:.2f}ms per eval)")
