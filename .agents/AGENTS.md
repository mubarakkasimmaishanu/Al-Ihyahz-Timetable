# Al-Ihyaz Academy Timetable System Guidelines & Rules

This project manages the conflict-free timetable scheduling engine and official aSc-styled timetable generation system for **Al-Ihyaz Academy**.

---

## 1. Teacher Naming Convention (MANDATORY)

> [!IMPORTANT]
> **NEVER** use shorthand codes (such as `MHN`, `MSH`, `MMB`, `MNF`) in place of teacher names.
> Always use the exact pattern provided by the administration:
> * **M. Hassan**
> * **M. Shehu**
> * **M. Mubarak**
> * **M. Nana Firdaus**
> * **M. Yusuf**
> * **M. Zainab Kabir**
> * **M. Sumayya**
> * **M. Abba**
* **M. Amina**
* **M. Maryam**
* **M. Nabila**

See full details in [.agents/rules/teacher-naming-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/teacher-naming-rules.md).

---

## 2. Institutional Scheduling Rules

* **Workload 50/50 Balance**: Balanced evenly before break (P1–P4) and after break (P5–P8), except for M. Shehu.
* **Paired Electives**:
  - `Government ↔ Physics` (Heavy w/ Heavy: M. Hassan & M. Shehu in SS 1–SS 3, morning P1–P6).
  - `Economics ↔ Chemistry` (Less Heavy w/ Less Heavy: M. Abba & M. Nana Firdaus in SS 1–SS 3, Chemistry strictly banned from Period 8).
  - `Biology ↔ Literature` (Less Heavy w/ Less Heavy: M. Amina & M. Hassan in SS 1–SS 3, balanced before/after break).
* **Double Periods**: 1 double + 2 singles for 4-contact subjects; never span across break (P4–P5).
* **Mathematics & English Placement Rule**: NEVER schedule Math or English in tired hours (no Math in P7 or P8 on Mon–Thu, no Math in P5 or P6 on Friday; no English in P8 on Mon–Thu or P5/P6 on Friday). Both subjects are prioritized in the first two periods in the morning (P1, P2) and immediately after break (P5).
* **Light Friday Policy for Heavy Subjects**: Heavy science and art subjects (`PHY`, `CHM`, `BIO`, `MTH`, `GOV`, `LIT`, `ECO`) must appear minimally on Friday (at most 1 single period per class). Strictly ZERO double periods and ZERO subject stacking on Friday.
* **No Clashes & Contact Preservation**: Full weekly contacts must be preserved; never silently drop periods.

See full details in [.agents/rules/timetable-scheduling-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/timetable-scheduling-rules.md) and [.agents/rules/general-allocation-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/general-allocation-rules.md).

---

## 3. Teacher Profile Notices

Consult each teacher's dedicated notice file before adjusting allocations or schedules:
* [Notice: M. Shehu](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-shehu.md) (22 contacts, Morning Only, 100% Free on Friday)
* [Notice: M. Mubarak](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-mubarak.md) (19 contacts, balanced)
* [Notice: M. Hassan](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-hassan.md) (24 contacts, paired Gov ↔ Phy & Lit ↔ Bio)
* [Notice: M. Nana Firdaus](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-nana-firdaus.md) (24 contacts, paired Chem ↔ Eco & BST)
* [Notice: M. Yusuf](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-yusuf.md) (10 contacts, Maths SS 2 & SS 3)
* [Notice: M. Zainab Kabir](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-zainab-kabir.md) (24 contacts, Friday Absent / Free, English & Business Studies JS 1–3)
* [Notice: M. Sumayya](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-sumayya.md) (24 contacts, English SS 1–3 & Computer JS 1–3, Protected from Tired Hours)
* [Notice: M. Abba](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-abba.md) (24 contacts, Economics SS 1–3 paired w/ Chem & Civic SS 1–3)
* [Notice: M. Amina](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-amina.md) (24 contacts, Biology SS 1–3 paired w/ Lit & Agric SS 1–3)
* [Notice: M. Maryam](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-maryam.md) (24 contacts, PVS JS 1–3, National Values JS 1–3 & IRS JS 1 & 3)
* [Notice: M. Nabila](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-nabila.md) (21 contacts, IRS SS 1–3, Hausa JS 1–3 & IRS JS 2 only)

---

## 4. Scheduling Engine Skills

Use the dedicated agent skill when generating, testing, or updating schedules:
* [Timetable Scheduling Skill](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/skills/timetable-scheduling/SKILL.md)
