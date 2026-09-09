# Timetable Scheduling Rules & Constraints

This document defines the mathematical, structural, and institutional constraints enforced by the Al-Ihyaz Academy Timetable Generator.

---

## 1. Workload Balancing (50/50 Rule)

* **General Rule**: Every teacher's weekly periods must be fairly and evenly balanced across:
  - **Before Break**: Periods 1 to 4 (~50% of total contacts).
  - **After Break**: Periods 5 to 8 (~50% of total contacts).
* **Exception**: **M. Shehu** is an MSc student who is strictly available in the morning only (Periods 1 to 4, with Period 5 only as fallback; never Periods 6, 7, or 8).
* **Weekly Spread**: Workloads must be distributed evenly across Monday to Friday; no single day should be overloaded beyond teacher daily limits.

---

## 2. Paired Elective Scheduling Arrangement

In Senior Secondary classes (SS 1, SS 2, SS 3), Science and Arts students split into specialized electives during the same period:

1. **Government ↔ Physics**:
   - When **M. Hassan** enters to teach **Government**, students taking Science move simultaneously to their **Physics class** with **M. Shehu**.
   - These periods must be scheduled in the exact same time slot for that class.
   - Because M. Shehu is morning-only, all paired Government ↔ Physics contacts are scheduled in the morning (Periods 1–4/5).

2. **Literature ↔ Chemistry**:
   - When **M. Hassan** enters to teach **Literature**, students taking Science move simultaneously to their **Chemistry class** with **M. Nana Firdaus**.
   - These periods must be scheduled in the exact same time slot for that class.
   - To achieve the required 50/50 balance for both M. Hassan and M. Nana Firdaus, all paired Literature ↔ Chemistry contacts are scheduled in the afternoon (Periods 5–8).

3. **Economics ↔ Biology**:
   - When **M. Abba** enters to teach **Economics**, students taking Science move simultaneously to their **Biology class** with **M. Amina**.
   - These periods must be scheduled in the exact same time slot for that class in SS 1, SS 2, and SS 3 (4 contacts each: 1 double + 2 singles).
   - Scheduled across the week to maintain optimal workload spread and prevent teacher fatigue.

---

## 3. Double Periods & Contact Rules

* **Viability**: Double periods (2 consecutive 40-minute periods on the same day) are encouraged where they improve pedagogical continuity, reduce idle transitions, and balance weekly loads.
* **Standard Decomposition for 4-contact subjects**:
  - 1 Double period + 2 Single periods across 3 distinct days.
* **Do Not Add Unnecessarily**: Double periods must not be created indiscriminately. They are only placed where they assist in balancing.
* **Break Boundary Rule**: Double periods must **NEVER** span across the breakfast break (i.e. Period 4 and Period 5 cannot form a double period).
* **Friday Paired Doubles Prohibited**: Double periods for paired senior electives (`Government ↔ Physics`, `Literature ↔ Chemistry`, and `Economics ↔ Biology`) must **NEVER** be placed on Friday. They belong strictly on Monday to Thursday (8-period days).
* **Friday Chemistry / Literature Load Cap**: Friday is a 6-period condensed day. The generator strictly caps Chemistry (and paired Literature) at **at most 1 single period on Friday** (never 2 or 3 periods). The remaining 11 contacts are distributed across Monday to Thursday.
* **No Subject Stacking**: Avoid assigning the same subject multiple times on the same day unless it is part of a deliberate double period.

---

## 4. Conflict-Free Invariants (Strict Zero-Clash Policy)

1. **Teacher Clashes**: A teacher can NEVER be assigned to two classes at the same day and period.
2. **Class Clashes**: A class cannot have two unrelated subjects scheduled at the same time. The only exception is approved parallel elective pairs (`Government ↔ Physics` and `Literature ↔ Chemistry`).
3. **Room / Facility Clashes**: No room conflicts.
4. **Contact Preservation**: Every subject in every class must receive 100% of its required weekly contacts. The generator must **never** silently drop or reduce contacts to make scheduling easier. If a conflict occurs, the system reports it explicitly as a diagnostic.

---

## 5. Mathematics Placement Rules (MANDATORY)

* **Strict Prohibition**: Mathematics must **NEVER** be scheduled in the 2nd to the last period or the last period of the school day:
  - **Monday to Thursday (8-period regular days)**: NEVER in **Period 7** or **Period 8**.
  - **Friday (6-period condensed day)**: NEVER in **Period 5** or **Period 6**.
* **Highly Encouraged Slots**:
  - **First Two Periods in the Morning (Periods 1 & 2)**: Prime cognitive window (8:10 – 9:20 AM) when student mental alertness, logical focus, and retention are at their highest.
  - **Immediately After Breakfast Break (Period 5)**: Post-refreshment window (11:10 – 11:50 AM) when students have rested and replenished their energy.
* **Secondary Allowed Slots**: Periods 3 and 4 (before break) are acceptable when required for weekly balancing. Period 6 on Monday–Thursday is heavily discouraged.

---

## 6. Light Friday Policy for Heavy Science & Arts Subjects (MANDATORY)

* **Institutional Intent**: Friday is a 6-period condensed day closing early for Juma'at prayer. Students must not be overburdened with cognitively demanding lab or heavy theory electives. Heavy science and art subjects must appear minimally ("appear little") on Friday.
* **Class Friday Heavy Load Cap**:
  - Heavy subjects (`PHY`, `CHM`, `BIO`, `MTH`, `GOV`, `LIT`, `ECO`) are strictly capped at **at most 1 single period per class on Friday** (with 0 heavy periods preferred).
  - Paired electives (`PHY ↔ GOV`, `CHM ↔ LIT`, `ECO ↔ BIO`) are prioritized Monday to Thursday, preventing senior elective clutter on Friday.
* **Zero Double Periods on Friday**:
  - All double periods across the entire school are strictly prohibited on Friday. All 2-period contiguous blocks belong on Monday to Thursday (8-period full days).
* **Zero Subject Stacking on Friday**:
  - No subject may be scheduled more than once in the same class on Friday. Every Friday contact must be a unique, single period.
* **Friday Curriculum Focus**:
  - Friday is prioritized for lighter, vocational, and digital subjects: Computer Studies (`CMP`), Civic Education (`CIV`), Data Processing (`DPR`), Basic Science & Tech (`BST`), Agricultural Science (`AGR`), and fresh morning English Language (`ENG`).
