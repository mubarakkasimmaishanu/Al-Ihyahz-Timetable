import json
import sqlite3
import copy
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
    base_slots = json.load(f)

# Step 1: Apply Move 1 & 2
js3_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 3')
bus_id = next(sid for sid, s in subjects.items() if s['code'] == 'BUS')
hausa_id = next(sid for sid, s in subjects.items() if s['code'] == 'HAUSA')
s_bus = next(s for s in base_slots if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 6 and s['subject_id'] == bus_id)
s_hausa = next(s for s in base_slots if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 7 and s['subject_id'] == hausa_id)
s_bus['period_index'] = 7
s_hausa['period_index'] = 6

js1_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 1')
nv_id = next(sid for sid, s in subjects.items() if s['code'] == 'NV')
irs_id = next(sid for sid, s in subjects.items() if s['code'] == 'IRS')
s_nv_thu = next(s for s in base_slots if s['class_id'] == js1_id and s['day'] == 'Thursday' and s['period_index'] == 4 and s['subject_id'] == nv_id)
s_irs_mon = next(s for s in base_slots if s['class_id'] == js1_id and s['day'] == 'Monday' and s['period_index'] == 6 and s['subject_id'] == irs_id)
s_nv_thu['day'], s_irs_mon['day'] = s_irs_mon['day'], s_nv_thu['day']
s_nv_thu['period_index'], s_irs_mon['period_index'] = s_irs_mon['period_index'], s_nv_thu['period_index']

# Step 2: In JS 1 Tue swap P7 CMP <-> P8 BUS
s_cmp_tue = next(s for s in base_slots if s['class_id'] == js1_id and s['day'] == 'Tuesday' and s['period_index'] == 7)
s_bus_tue = next(s for s in base_slots if s['class_id'] == js1_id and s['day'] == 'Tuesday' and s['period_index'] == 8)
s_cmp_tue['period_index'] = 8
s_bus_tue['period_index'] = 7

# Step 3: In JS 2 Tue swap P4 BUS <-> P8 IRS
js2_id = next(cid for cid, c in classes.items() if c['name'] == 'JS 2')
s_bus_js2 = next(s for s in base_slots if s['class_id'] == js2_id and s['day'] == 'Tuesday' and s['period_index'] == 4)
s_irs_js2 = next(s for s in base_slots if s['class_id'] == js2_id and s['day'] == 'Tuesday' and s['period_index'] == 8)
s_bus_js2['period_index'] = 8
s_irs_js2['period_index'] = 4

def evaluate(slts):
    hard_penalty = 0
    soft_penalty = 0
    issues = []

    teacher_time = defaultdict(list)
    for s in slts:
        key = (s['teacher_id'], s['day'], s['period_index'])
        teacher_time[key].append(s)
        if len(teacher_time[key]) > 1:
            hard_penalty += 100000
            t_name = teachers[s['teacher_id']]['name']
            issues.append(f"Teacher {t_name} clash at {s['day']} P{s['period_index']}")

    class_time = defaultdict(list)
    for s in slts:
        key = (s['class_id'], s['day'], s['period_index'])
        class_time[key].append(s)
    
    for key, grp in class_time.items():
        if len(grp) > 1:
            if len(grp) == 2:
                c1 = subjects[grp[0]['subject_id']]['code']
                c2 = subjects[grp[1]['subject_id']]['code']
                pair = "/".join(sorted([c1, c2]))
                if pair not in ['GOV/PHY', 'CHM/ECO', 'BIO/LIT']:
                    hard_penalty += 100000
                    issues.append(f"Illegal simultaneous {pair} at {key}")
            else:
                hard_penalty += 100000
                issues.append(f"Overbooked class at {key}")

    for s in slts:
        day = s['day']
        p = s['period_index']
        t_name = teachers[s['teacher_id']]['name']
        c_name = classes[s['class_id']]['name']
        is_jun = c_name.startswith('JS')

        if (day == 'Monday' or day == 'Friday') and p == 1:
            hard_penalty += 100000
            issues.append(f"Class during assembly {day} P1")

        if day == 'Friday':
            if is_jun and p > 4:
                hard_penalty += 100000
                issues.append(f"Junior Friday after P4: {c_name} P{p}")
            if not is_jun and p > 6:
                hard_penalty += 100000
                issues.append(f"Senior Friday after P6: {c_name} P{p}")
            if 'Shehu' in t_name or 'Zainab' in t_name:
                hard_penalty += 100000
                issues.append(f"{t_name} scheduled on Friday")

        if 'Shehu' in t_name and p > 6:
            hard_penalty += 100000
            issues.append(f"M. Shehu scheduled after P6: P{p}")

        code = subjects[s['subject_id']]['code']
        if code == 'MTH':
            if day != 'Friday' and p >= 7:
                hard_penalty += 50000
                issues.append(f"Math in tired hours {day} P{p}")
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
                issues.append(f"Math on Friday tired hours P{p}")
        if code == 'ENG':
            if day != 'Friday' and p >= 8:
                hard_penalty += 50000
                issues.append(f"English in P8 {day} P{p}")
            if day == 'Friday' and p >= 5:
                hard_penalty += 50000
                issues.append(f"English on Friday tired hours P{p}")
        if code == 'CHM' and p == 8:
            hard_penalty += 50000
            issues.append(f"Chemistry in P8")

    for c_id, cls in classes.items():
        for d in DAYS:
            c_slots = [s for s in slts if s['class_id'] == c_id and s['day'] == d]
            sub_occur = defaultdict(list)
            for s in c_slots:
                sub_occur[s['subject_id']].append(s['period_index'])
            for s_id, periods in sub_occur.items():
                if len(periods) > 2:
                    hard_penalty += 50000
                    issues.append(f"Subject {subjects[s_id]['code']} > 2 times in {cls['name']} on {d}")
                elif len(periods) == 2:
                    if abs(periods[0] - periods[1]) != 1:
                        hard_penalty += 50000
                        issues.append(f"Subject {subjects[s_id]['code']} split in {cls['name']} on {d}")
                    elif min(periods) == 4 and d != 'Friday':
                        hard_penalty += 50000
                        issues.append(f"Double across break in {cls['name']} on {d}")

    p8_counts = defaultdict(int)
    for s in slts:
        if s['period_index'] == 8:
            t_name = teachers[s['teacher_id']]['name']
            p8_counts[t_name] += 1
    
    p8_diff = 0
    for t_name, target in TARGET_P8.items():
        actual = p8_counts[t_name]
        if actual != target:
            diff = abs(actual - target)
            p8_diff += diff
            soft_penalty += diff * 2000
            issues.append(f"Period 8: {t_name} has {actual} slots (target: {target})")

    for t_id, t in teachers.items():
        for d in DAYS:
            t_slots = [s for s in slts if s['teacher_id'] == t_id and s['day'] == d]
            m_doubles = 0
            for p in range(1, 4):
                s1 = next((s for s in t_slots if s['period_index'] == p), None)
                s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
                if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                    m_doubles += 1
            if m_doubles > 1:
                soft_penalty += (m_doubles - 1) * 2000
                issues.append(f"{t['name']} on {d} has {m_doubles} morning doubles")

            a_doubles = 0
            for p in range(5, 8):
                s1 = next((s for s in t_slots if s['period_index'] == p), None)
                s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
                if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                    a_doubles += 1
            if a_doubles > 1:
                soft_penalty += (a_doubles - 1) * 2000
                issues.append(f"{t['name']} on {d} has {a_doubles} afternoon doubles")

            s3 = next((s for s in t_slots if s['period_index'] == 3), None)
            s4 = next((s for s in t_slots if s['period_index'] == 4), None)
            s5 = next((s for s in t_slots if s['period_index'] == 5), None)
            s6 = next((s for s in t_slots if s['period_index'] == 6), None)
            if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
                s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
                soft_penalty += 2000
                issues.append(f"{t['name']} on {d} back-to-back doubles P3-P4 and P5-P6")

    adj_count = 0
    for c_id, cls in classes.items():
        for d in DAYS:
            c_slots = sorted([s for s in slts if s['class_id'] == c_id and s['day'] == d], key=lambda x: x['period_index'])
            for i in range(len(c_slots) - 1):
                s1 = c_slots[i]
                s2 = c_slots[i+1]
                if s2['period_index'] == s1['period_index'] + 1 and s1['teacher_id'] == s2['teacher_id'] and s1['subject_id'] != s2['subject_id']:
                    adj_count += 1
                    soft_penalty += 3000
                    issues.append(f"Adjacent diff subjects in {cls['name']} on {d}: {teachers[s1['teacher_id']]['name']} ({subjects[s1['subject_id']]['code']} P{s1['period_index']} -> {subjects[s2['subject_id']]['code']} P{s2['period_index']})")

    total = hard_penalty + soft_penalty
    return total, hard_penalty, soft_penalty, issues, p8_diff, adj_count

# Search for moves resolving SS 2 Wednesday without affecting Period 8 (p != 8)
ss2_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 2')
agr_id = next(sid for sid, s in subjects.items() if s['code'] == 'AGR')
ss2_wed_p3_idx = next(i for i, s in enumerate(base_slots) if s['class_id'] == ss2_id and s['day'] == 'Wednesday' and s['period_index'] == 3 and s['subject_id'] == agr_id)

ss2_indices = [i for i, s in enumerate(base_slots) if s['class_id'] == ss2_id and s['period_index'] != 8]

print("Searching non-P8 moves for SS 2...")
for i_b in ss2_indices:
    if i_b == ss2_wed_p3_idx:
        continue
    sA = base_slots[ss2_wed_p3_idx]
    sB = base_slots[i_b]
    partnerB = next((k for k in range(len(base_slots)) if k != i_b and base_slots[k]['class_id'] == ss2_id and base_slots[k]['day'] == sB['day'] and base_slots[k]['period_index'] == sB['period_index']), None)
    if partnerB is not None:
        continue # partner elective

    dA, pA = sA['day'], sA['period_index']
    dB, pB = sB['day'], sB['period_index']
    sA['day'], sA['period_index'] = dB, pB
    sB['day'], sB['period_index'] = dA, pA

    tot, h, s, iss, p8_diff, adj = evaluate(base_slots)
    if h == 0 and p8_diff == 0 and adj == 0:
        print(f"Direct swap found: Wed P3 <-> {dA} P{pA} ({subjects[sB['subject_id']]['code']}): Score={tot}, Issues={len(iss)}")

    sA['day'], sA['period_index'] = dA, pA
    sB['day'], sB['period_index'] = dB, pB

# 3-way rotation within SS 2 (non-P8)
for i_b in ss2_indices:
    if i_b == ss2_wed_p3_idx:
        continue
    for i_c in ss2_indices:
        if i_c in (ss2_wed_p3_idx, i_b):
            continue
        sA = base_slots[ss2_wed_p3_idx]
        sB = base_slots[i_b]
        sC = base_slots[i_c]

        dA, pA = sA['day'], sA['period_index']
        dB, pB = sB['day'], sB['period_index']
        dC, pC = sC['day'], sC['period_index']

        sA['day'], sA['period_index'] = dB, pB
        sB['day'], sB['period_index'] = dC, pC
        sC['day'], sC['period_index'] = dA, pA

        tot, h, s, iss, p8_diff, adj = evaluate(base_slots)
        if h == 0 and p8_diff == 0 and adj == 0:
            print(f"3-way rotation found: A->{dB} P{pB} ({subjects[sB['subject_id']]['code']}), B->{dC} P{pC} ({subjects[sC['subject_id']]['code']}): Score={tot}, Issues={len(iss)}")

        sA['day'], sA['period_index'] = dA, pA
        sB['day'], sB['period_index'] = dB, pB
        sC['day'], sC['period_index'] = dC, pC
