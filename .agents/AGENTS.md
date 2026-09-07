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

See full details in [.agents/rules/teacher-naming-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/teacher-naming-rules.md).

---

## 2. Institutional Scheduling Rules

* **Workload 50/50 Balance**: Balanced evenly before break (P1–P4) and after break (P5–P8), except for M. Shehu.
* **Paired Electives**:
  - `Government ↔ Physics` (M. Hassan & M. Shehu in SS 1–SS 3, morning).
  - `Literature ↔ Chemistry` (M. Hassan & M. Nana Firdaus in SS 1–SS 3, afternoon).
* **Double Periods**: 1 double + 2 singles for 4-contact subjects; never span across break (P4–P5).
* **Mathematics Placement Rule**: NEVER schedule Math in the 2nd to last or last period (never P7 or P8 on Mon–Thu; never P5 or P6 on Friday). Math is highly encouraged in the first two periods in the morning (P1, P2) and immediately after break (P5).
* **No Clashes & Contact Preservation**: Full weekly contacts must be preserved; never silently drop periods.

See full details in [.agents/rules/timetable-scheduling-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/timetable-scheduling-rules.md) and [.agents/rules/general-allocation-rules.md](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/rules/general-allocation-rules.md).

---

## 3. Teacher Profile Notices

Consult each teacher's dedicated notice file before adjusting allocations or schedules:
* [Notice: M. Shehu](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-shehu.md) (22 contacts, Morning Only)
* [Notice: M. Mubarak](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-mubarak.md) (19 contacts, balanced)
* [Notice: M. Hassan](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-hassan.md) (24 contacts, paired Gov/Lit)
* [Notice: M. Nana Firdaus](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-nana-firdaus.md) (24 contacts, paired Chem/BST)
* [Notice: M. Yusuf](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-yusuf.md) (10 contacts, Maths SS 2 & SS 3)
* [Notice: M. Zainab Kabir](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/notices/notice-m-zainab-kabir.md) (24 contacts, Friday Absent / Free, English & Business Studies JS 1–3)

---

## 4. Scheduling Engine Skills

Use the dedicated agent skill when generating, testing, or updating schedules:
* [Timetable Scheduling Skill](file:///c:/Users/MY%20PC/Desktop/Al-Ihyahz%20Timetable/.agents/skills/timetable-scheduling/SKILL.md)
