# Teacher Naming & Representation Rules

## Core Rule: Use Exact "M. [Name]" Pattern

Teachers must **NEVER** be displayed, identified, or referred to merely as shorthand codes (such as `MSH`, `MMB`, `MHN`, `MNF`) in place of their names. 

Always adhere strictly to the exact teacher naming pattern provided:

* **M. Hassan** (not `MHN` or `Hassan`)
* **M. Shehu** (not `MSH` or `Shehu`)
* **M. Mubarak** (not `MMB` or `Mubarak`)
* **M. Nana Firdaus** (not `MNF` or `Nana Firdaus`)
* **M. Yusuf** (not `MYS` or `Yusuf`)
* **M. Zainab Kabir** (not `MZK` or `Zainab Kabir`)

---

## Application Guidelines

1. **User Interface & Timetable Sheets**:
   - In single lesson cells, render: `M. Hassan`, `M. Shehu`, `M. Mubarak`, `M. Nana Firdaus`, `M. Yusuf`.
   - In paired elective cells (e.g., Science / Arts splits), format both teachers with their full honorific names:
     - `M. Shehu | M. Hassan`
     - `M. Nana Firdaus | M. Hassan`
   - In Teacher Dropdowns and Header metadata, always display the full pattern: `Teacher M. Hassan`, `Teacher M. Shehu`, `Teacher M. Yusuf`, etc.

2. **Communication & Reports**:
   - When discussing schedules, workloads, clashes, or diagnostics with the user, always use the full pattern: `M. Hassan`, `M. Shehu`, `M. Mubarak`, `M. Nana Firdaus`, `M. Yusuf`.
   - Never substitute the teacher code for the teacher name in conversational responses.

3. **Database Records**:
   - The `teachers.name` field must store the exact pattern `M. Hassan`, `M. Shehu`, `M. Mubarak`, `M. Nana Firdaus`, `M. Yusuf`.
   - The internal `code` column is strictly an auxiliary database key/identifier and must never replace the human-facing name.
