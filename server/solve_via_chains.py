import json
import sqlite3
import random
import copy
from collections import defaultdict
import math
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
    initial_slots = json.load(f)

def evaluate(slts):
    hard_penalty = 0
    soft_penalty = 0
    issues = []

    # 1. Teacher clashes
    teacher_time = defaultdict(list)
    for s in slts:
        key = (s['teacher_id'], s['day'], s['period_index'])
        teacher_time[key].append(s)
        if len(teacher_time[key]) > 1:
            hard_penalty += 100000
            t_name = teachers[s['teacher_id']]['name']
            issues.append(f"Teacher {t_name} clash at {s['day']} P{s['period_index']}")

    # 2. Class clashes (except paired electives)
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

    # 3. Assembly & Friday dismissal & teacher constraints
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

    # 4. Duplicate subject on same day in class
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

    # 5. USER COMPLAINT 1: Period 8 Equality
    p8_counts = defaultdict(int)
    for s in slts:
        if s['period_index'] == 8:
            t_name = teachers[s['teacher_id']]['name']
            p8_counts[t_name] += 1
    
    for t_name, target in TARGET_P8.items():
        actual = p8_counts[t_name]
        if actual != target:
            diff = abs(actual - target)
            soft_penalty += diff * 1500
            issues.append(f"Period 8: {t_name} has {actual} slots (target: {target})")

    # 6. USER COMPLAINT 2: No double-double without break
    for t_id, t in teachers.items():
        for d in DAYS:
            t_slots = [s for s in slts if s['teacher_id'] == t_id and s['day'] == d]
            # Morning doubles
            m_doubles = 0
            for p in range(1, 4):
                s1 = next((s for s in t_slots if s['period_index'] == p), None)
                s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
                if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                    m_doubles += 1
            if m_doubles > 1:
                soft_penalty += (m_doubles - 1) * 2000
                issues.append(f"{t['name']} on {d} has {m_doubles} morning doubles")

            # Afternoon doubles
            a_doubles = 0
            for p in range(5, 8):
                s1 = next((s for s in t_slots if s['period_index'] == p), None)
                s2 = next((s for s in t_slots if s['period_index'] == p + 1), None)
                if s1 and s2 and s1['subject_id'] == s2['subject_id'] and s1['class_id'] == s2['class_id']:
                    a_doubles += 1
            if a_doubles > 1:
                soft_penalty += (a_doubles - 1) * 2000
                issues.append(f"{t['name']} on {d} has {a_doubles} afternoon doubles")

            # Back to back across break
            s3 = next((s for s in t_slots if s['period_index'] == 3), None)
            s4 = next((s for s in t_slots if s['period_index'] == 4), None)
            s5 = next((s for s in t_slots if s['period_index'] == 5), None)
            s6 = next((s for s in t_slots if s['period_index'] == 6), None)
            if (s3 and s4 and s3['subject_id'] == s4['subject_id'] and s3['class_id'] == s4['class_id'] and
                s5 and s6 and s5['subject_id'] == s6['subject_id'] and s5['class_id'] == s6['class_id']):
                soft_penalty += 2000
                issues.append(f"{t['name']} on {d} back-to-back doubles P3-P4 and P5-P6")

    # 7. USER COMPLAINT 3: Adjacent different subjects in same class
    for c_id, cls in classes.items():
        for d in DAYS:
            c_slots = sorted([s for s in slts if s['class_id'] == c_id and s['day'] == d], key=lambda x: x['period_index'])
            for i in range(len(c_slots) - 1):
                s1 = c_slots[i]
                s2 = c_slots[i+1]
                if s2['period_index'] == s1['period_index'] + 1 and s1['teacher_id'] == s2['teacher_id'] and s1['subject_id'] != s2['subject_id']:
                    soft_penalty += 3000
                    issues.append(f"Adjacent different subjects in {cls['name']} on {d}: {teachers[s1['teacher_id']]['name']} ({subjects[s1['subject_id']]['code']} P{s1['period_index']} -> {subjects[s2['subject_id']]['code']} P{s2['period_index']})")

    total = hard_penalty + soft_penalty
    return total, hard_penalty, soft_penalty, issues

init_total, init_hard, init_soft, init_issues = evaluate(initial_slots)
print(f"Starting score: Total={init_total} (Hard={init_hard}, Soft={init_soft}, Issues={len(init_issues)})")

current_slots = copy.deepcopy(initial_slots)
best_slots = copy.deepcopy(initial_slots)
best_score = init_total

# Pre-index slots by class for fast selection
class_slots_map = defaultdict(list)
for idx, s in enumerate(current_slots):
    class_slots_map[s['class_id']].append(idx)

# Search loop
print("Beginning local search optimization...")
start_time = time.time()
T = 20.0
alpha = 0.99995

for it in range(1, 200001):
    c_id = random.choice(list(class_slots_map.keys()))
    c_indices = class_slots_map[c_id]
    
    idxA, idxB = random.sample(c_indices, 2)
    sA = current_slots[idxA]
    sB = current_slots[idxB]

    if sA['day'] == sB['day'] and sA['period_index'] == sB['period_index']:
        continue

    # Find partner slots if paired simultaneous elective
    partnerA_idx = next((i for i in c_indices if i != idxA and current_slots[i]['day'] == sA['day'] and current_slots[i]['period_index'] == sA['period_index']), None)
    partnerB_idx = next((i for i in c_indices if i != idxB and current_slots[i]['day'] == sB['day'] and current_slots[i]['period_index'] == sB['period_index']), None)

    if (partnerA_idx is not None and partnerB_idx is None) or (partnerA_idx is None and partnerB_idx is not None):
        continue

    # Perform swap
    dayA, pA = sA['day'], sA['period_index']
    dayB, pB = sB['day'], sB['period_index']

    sA['day'], sA['period_index'] = dayB, pB
    sB['day'], sB['period_index'] = dayA, pA

    if partnerA_idx is not None and partnerB_idx is not None:
        current_slots[partnerA_idx]['day'], current_slots[partnerA_idx]['period_index'] = dayB, pB
        current_slots[partnerB_idx]['day'], current_slots[partnerB_idx]['period_index'] = dayA, pA

    tot, h, s, _ = evaluate(current_slots)

    # We only accept if hard_penalty == 0
    if h == 0:
        delta = tot - best_score
        if tot < best_score:
            best_score = tot
            best_slots = copy.deepcopy(current_slots)
            print(f"[Iter {it}] NEW BEST Score={best_score} (Soft={s}) in {time.time()-start_time:.1f}s")
            if best_score == 0:
                print("🎉 PERFECT SCORE 0 ACHIEVED!")
                break
        elif math.exp(-max(0, tot - best_score) / max(0.1, T)) > random.random():
            # accept move
            pass
        else:
            # revert
            sA['day'], sA['period_index'] = dayA, pA
            sB['day'], sB['period_index'] = dayB, pB
            if partnerA_idx is not None and partnerB_idx is not None:
                current_slots[partnerA_idx]['day'], current_slots[partnerA_idx]['period_index'] = dayA, pA
                current_slots[partnerB_idx]['day'], current_slots[partnerB_idx]['period_index'] = dayB, pB
    else:
        # revert
        sA['day'], sA['period_index'] = dayA, pA
        sB['day'], sB['period_index'] = dayB, pB
        if partnerA_idx is not None and partnerB_idx is not None:
            current_slots[partnerA_idx]['day'], current_slots[partnerA_idx]['period_index'] = dayA, pA
            current_slots[partnerB_idx]['day'], current_slots[partnerB_idx]['period_index'] = dayB, pB

    T *= alpha

final_tot, final_h, final_s, final_issues = evaluate(best_slots)
print(f"\nFinal Result: Total={final_tot} (Hard={final_h}, Soft={final_s}, Issues={len(final_issues)})")
for iss in final_issues:
    print(f"  * {iss}")

if final_tot == 0 or final_h == 0 and len(final_issues) < len(init_issues):
    print("\nSaving improved/perfect timetable...")
    with open('server/data/solved_246_slots.json', 'w', encoding='utf-8') as f:
        json.dump(best_slots, f, indent=2)
    print("Saved to server/data/solved_246_slots.json")

    # Commit to SQLite
    cursor.execute("DELETE FROM timetable_slots")
    for s in best_slots:
        cursor.execute("""
            INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day, period_index, is_locked)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (s['class_id'], s['subject_id'], s['teacher_id'], s['day'], s['period_index'], s.get('is_locked', 0)))
    conn.commit()
    print("Committed to SQLite timetable_slots table!")

    # Check P8 counts
    p8_counts = defaultdict(int)
    for s in best_slots:
        if s['period_index'] == 8:
            t_name = teachers[s['teacher_id']]['name']
            p8_counts[t_name] += 1
    print("\nFinal Period 8 Distribution:")
    for t_id, t in teachers.items():
        print(f"  {t['name'].ljust(20)}: {p8_counts[t['name']]} slots")
