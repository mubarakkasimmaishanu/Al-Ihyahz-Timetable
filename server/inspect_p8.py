import json, sqlite3

conn = sqlite3.connect('server/db/timetable.sqlite')
cursor = conn.cursor()
classes = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM classes')}
teachers = {row[0]: row[1] for row in cursor.execute('SELECT id, name FROM teachers')}
subjects = {row[0]: row[1] for row in cursor.execute('SELECT id, code FROM subjects')}

with open('server/data/solved_246_slots.json', 'r', encoding='utf-8') as f:
    slts = json.load(f)

# Apply Move 1, 2, and Rotation 3
js3_id = next(cid for cid, c in classes.items() if c == 'JS 3')
bus_id = next(sid for sid, s in subjects.items() if s == 'BUS')
hausa_id = next(sid for sid, s in subjects.items() if s == 'HAUSA')
s_bus = next(s for s in slts if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 6 and s['subject_id'] == bus_id)
s_hausa = next(s for s in slts if s['class_id'] == js3_id and s['day'] == 'Thursday' and s['period_index'] == 7 and s['subject_id'] == hausa_id)
s_bus['period_index'] = 7
s_hausa['period_index'] = 6

js1_id = next(cid for cid, c in classes.items() if c == 'JS 1')
nv_id = next(sid for sid, s in subjects.items() if s == 'NV')
irs_id = next(sid for sid, s in subjects.items() if s == 'IRS')
s_nv_thu = next(s for s in slts if s['class_id'] == js1_id and s['day'] == 'Thursday' and s['period_index'] == 4 and s['subject_id'] == nv_id)
s_irs_mon = next(s for s in slts if s['class_id'] == js1_id and s['day'] == 'Monday' and s['period_index'] == 6 and s['subject_id'] == irs_id)
s_nv_thu['day'], s_irs_mon['day'] = s_irs_mon['day'], s_nv_thu['day']
s_nv_thu['period_index'], s_irs_mon['period_index'] = s_irs_mon['period_index'], s_nv_thu['period_index']

ss2_id = next(cid for cid, c in classes.items() if c == 'SS 2')
agr_id = next(sid for sid, s in subjects.items() if s == 'AGR')
dpr_id = next(sid for sid, s in subjects.items() if s == 'DPR')
sA = next(s for s in slts if s['class_id'] == ss2_id and s['day'] == 'Wednesday' and s['period_index'] == 3 and s['subject_id'] == agr_id)
sB = next(s for s in slts if s['class_id'] == ss2_id and s['day'] == 'Thursday' and s['period_index'] == 8 and s['subject_id'] == dpr_id)
sC = next(s for s in slts if s['class_id'] == ss2_id and s['day'] == 'Wednesday' and s['period_index'] == 8 and s['subject_id'] == irs_id)

sA['day'], sA['period_index'] = 'Thursday', 8
sB['day'], sB['period_index'] = 'Wednesday', 8
sC['day'], sC['period_index'] = 'Wednesday', 3

print("=== ALL 24 PERIOD 8 SLOTS ===")
for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday']:
    print(f"\n--- {d} Period 8 ---")
    for c_name in ['JS 1', 'JS 2', 'JS 3', 'SS 1', 'SS 2', 'SS 3']:
        cid = next(i for i, name in classes.items() if name == c_name)
        s = next(s for s in slts if s['class_id'] == cid and s['day'] == d and s['period_index'] == 8)
        print(f"  {c_name}: {subjects[s['subject_id']]} ({teachers[s['teacher_id']]})")
