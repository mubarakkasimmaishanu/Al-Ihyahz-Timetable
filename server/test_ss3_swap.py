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

from test_further_cleanup import evaluate, get_class_units

cur_tot, cur_h, cur_s, cur_p8, cur_dd, cur_adj, cur_iss = evaluate(slots)
print(f"Current State: Hard={cur_h}, P8={cur_p8}, DD={cur_dd}, Adj={cur_adj}")

ss3_id = next(cid for cid, c in classes.items() if c['name'] == 'SS 3')
units = get_class_units(slots, ss3_id)
u_singles = [u for u in units if u['type'] == 'single']

print(f"Testing all {len(u_singles)*(len(u_singles)-1)//2} single pairs in SS 3...")
for i in range(len(u_singles)):
    for j in range(i + 1, len(u_singles)):
        uA, uB = u_singles[i], u_singles[j]
        dA, pA = uA['day'], uA['periods'][0]
        dB, pB = uB['day'], uB['periods'][0]

        revert = []
        for s in uA['slots']:
            revert.append((s, s['day'], s['period_index']))
            s['day'], s['period_index'] = dB, pB
        for s in uB['slots']:
            revert.append((s, s['day'], s['period_index']))
            s['day'], s['period_index'] = dA, pA

        tot, h, s, p8, dd, adj, iss = evaluate(slots)
        # Check if this fixes SS 3 adjacent
        ss3_adj = any('SS 3' in x for x in iss if 'Adjacent' in x)
        if h == 0 and p8 == 0 and not ss3_adj:
            subA = "/".join(subjects[x['subject_id']]['code'] for x in uA['slots'])
            subB = "/".join(subjects[x['subject_id']]['code'] for x in uB['slots'])
            print(f"  SUCCESS! Swap {dA} P{pA} ({subA}) <-> {dB} P{pB} ({subB}) => Hard={h}, P8={p8}, Adj={adj}, DD={dd}")

        for s, d_orig, p_orig in revert:
            s['day'] = d_orig
            s['period_index'] = p_orig
