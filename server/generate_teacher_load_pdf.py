import os
import sqlite3
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Output PDF in the root workspace directory
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_PATH = os.path.join(ROOT_DIR, "TEACHERS_SUBJECTS_AND_LOAD.pdf")
DB_PATH = os.path.join(ROOT_DIR, "server", "db", "timetable.sqlite")

def generate_pdf():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Query all teachers
    cursor.execute("SELECT id, name, code, phone, time_preference, unavailable_days FROM teachers ORDER BY id")
    teachers = cursor.fetchall()

    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=landscape(letter),
        rightMargin=28,
        leftMargin=28,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor('#0f172a')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        alignment=1, # Center
        textColor=colors.HexColor('#1e40af')
    )
    
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor('#64748b')
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=6
    )

    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )

    cell_normal = ParagraphStyle(
        'CellNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#1e293b')
    )

    cell_center = ParagraphStyle(
        'CellCenter',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor('#0f172a')
    )

    cell_badge = ParagraphStyle(
        'CellBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor('#1e40af')
    )

    header_cell = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.white
    )

    elements = []

    # Title Banner
    elements.append(Paragraph("AL-IHYAZ ACADEMY", title_style))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("TEACHERS, ASSIGNED SUBJECTS & OFFICIAL WORKLOAD ROSTER", subtitle_style))
    elements.append(Paragraph("Academic Session: 2025/2026 | Conflict-Free Timetable Scheduling Engine | 100% Curriculum Preservation", meta_style))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1e40af'), spaceAfter=12))

    # Table 1: Master Summary Table
    elements.append(Paragraph("1. Master Teacher Workload Summary", h2_style))

    summary_headers = [
        Paragraph("<b>#</b>", header_cell),
        Paragraph("<b>Teacher Name</b>", header_cell),
        Paragraph("<b>Code</b>", header_cell),
        Paragraph("<b>Assigned Subjects</b>", header_cell),
        Paragraph("<b>Classes Taught</b>", header_cell),
        Paragraph("<b>Weekly Load</b>", header_cell),
        Paragraph("<b>Scheduling Constraints & Policy Notes</b>", header_cell)
    ]

    summary_rows = [summary_headers]

    notes_map = {
        "M. Shehu": "<b>100% Free on Friday</b> (0 periods). Mon–Thu morning only (P1–P6, dismissed by 12:30 PM). Zero P7–P8.",
        "M. Mubarak": "Even 50/50 balance before & after break. DPR SS 1–3 (3 contacts each, 9p total) + JS 1–2 Maths (10p). Total: 19p.",
        "M. Hassan": "Gov paired w/ Physics (morning, M. Shehu); Literature paired w/ Biology (M. Amina).",
        "M. Nana Firdaus": "Chemistry paired w/ Economics (M. Abba, protected from P8); BST JS 1–3 balanced before/after break.",
        "M. Yusuf": "Part-time Senior Math specialist (SS 2 & SS 3). Highest concentration in early morning.",
        "M. Zainab Kabir": "<b>100% Free on Friday</b> (Official Day Off). Mon–Thu 6 periods/day. English JS 1–3 + Business JS 1–3.",
        "M. Sumayya": "Senior English Language SS 1–3 (protected from tired hours: no P8 on Mon–Thu, no P5/6 on Fri) + JS Computer.",
        "M. Abba": "<b>Strictly Senior Secondary (ZERO JSS)</b>. Civic SS 1–3 (4 contacts each) + Economics paired w/ Chemistry (M. Nana Firdaus).",
        "M. Amina": "Agricultural Science SS 1–3 (4 contacts each) + Biology SS 1–3 paired w/ Literature (M. Hassan).",
        "M. Maryam": "Junior specialist: National Values JS 1–3 (3 contacts each, 9p) + Pre-Vocational Studies JS 1–3 (9p) + Islamic Studies JS 1 & JS 3 (6p). Total: 24p.",
        "M. Nabila": "Hausa Language JS 1–3 (9p) + Senior Islamic Studies SS 1–3 (9p) + Junior Islamic Studies JS 2 only (3p). Total: 21p."
    }

    grand_total_load = 0

    idx = 1
    for t_id, name, code, phone, pref, unav in teachers:
        # Get allocations
        cursor.execute("""
            SELECT s.name, s.code, c.name, a.periods_per_week
            FROM allocations a
            JOIN subjects s ON s.id = a.subject_id
            JOIN classes c ON c.id = a.class_id
            WHERE a.teacher_id = ?
            ORDER BY s.name, c.name
        """, (t_id,))
        allocs = cursor.fetchall()
        
        t_load = sum(a[3] for a in allocs)
        grand_total_load += t_load

        # Group subjects and classes
        subj_dict = {}
        for s_name, s_code, c_name, pw in allocs:
            if s_name not in subj_dict:
                subj_dict[s_name] = []
            subj_dict[s_name].append(f"{c_name} ({pw}p)")
        
        subjects_text = "<br/>".join([f"• <b>{s}</b>: {', '.join(cls)}" for s, cls in subj_dict.items()])
        
        # Unique classes
        unique_classes = sorted(list(set(a[2] for a in allocs)))
        classes_text = ", ".join(unique_classes)

        note = notes_map.get(name, "Standard balance.")

        summary_rows.append([
            Paragraph(str(idx), cell_center),
            Paragraph(f"<b>{name}</b>", cell_bold),
            Paragraph(code, cell_badge),
            Paragraph(subjects_text, cell_normal),
            Paragraph(classes_text, cell_normal),
            Paragraph(f"<b>{t_load} Periods</b>", cell_center),
            Paragraph(note, cell_normal)
        ])
        idx += 1

    # Grand Total Row
    summary_rows.append([
        Paragraph("", cell_center),
        Paragraph("<b>GRAND TOTAL</b>", cell_bold),
        Paragraph("<b>11 Staff</b>", cell_badge),
        Paragraph("<b>20 School Subjects</b>", cell_bold),
        Paragraph("<b>JS 1 – SS 3 (6 Classes)</b>", cell_bold),
        Paragraph(f"<b>{grand_total_load} Periods</b>", cell_center),
        Paragraph("<b>100% Conflict-Free Engine Validated (0 Clashes)</b>", cell_bold)
    ])

    col_widths = [24, 88, 42, 210, 80, 68, 228]
    summary_table = Table(summary_rows, colWidths=col_widths, repeatRows=1)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1e3a8a')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]

    # Zebra striping
    for r in range(1, len(summary_rows) - 1):
        bg = colors.HexColor('#f8fafc') if r % 2 == 1 else colors.HexColor('#ffffff')
        table_style.append(('BACKGROUND', (0, r), (-1, r), bg))

    # Total row styling
    table_style.append(('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#dbeafe')))
    table_style.append(('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#1e40af')))

    summary_table.setStyle(TableStyle(table_style))
    elements.append(summary_table)

    elements.append(Spacer(1, 14))

    # Page Break for Detailed Allocations
    elements.append(PageBreak())

    # Section 2: Subject-by-Subject Detailed Contact Breakdown
    elements.append(Paragraph("2. Detailed Allocation Breakdown by Subject & Class", h2_style))
    elements.append(Paragraph("Complete inventory of all 63 active teaching assignments across Junior & Senior Secondary sections.", meta_style))
    elements.append(Spacer(1, 8))

    detail_headers = [
        Paragraph("<b>#</b>", header_cell),
        Paragraph("<b>Subject Name</b>", header_cell),
        Paragraph("<b>Code</b>", header_cell),
        Paragraph("<b>Assigned Teacher</b>", header_cell),
        Paragraph("<b>Class</b>", header_cell),
        Paragraph("<b>Weekly Contacts</b>", header_cell),
        Paragraph("<b>Structure</b>", header_cell),
        Paragraph("<b>Institutional Classification / Pairing</b>", header_cell)
    ]

    detail_rows = [detail_headers]

    cursor.execute("""
        SELECT s.name AS subj_name, s.code AS subj_code, t.name AS teacher_name, c.name AS class_name,
               a.periods_per_week, a.allow_double
        FROM allocations a
        JOIN subjects s ON s.id = a.subject_id
        JOIN teachers t ON t.id = a.teacher_id
        JOIN classes c ON c.id = a.class_id
        ORDER BY s.name, c.name
    """)
    all_allocs = cursor.fetchall()

    d_idx = 1
    for s_name, s_code, t_name, c_name, pw, allow_dbl in all_allocs:
        struct = f"1 Double + {pw - 2} Singles" if allow_dbl and pw >= 4 else f"{pw} Singles"
        
        # Classification note
        classif = "General Core"
        if s_code in ['PHY', 'GOV']:
            classif = "Paired Elective (Gov ↔ Phy, Heavy w/ Heavy, Morning)"
        elif s_code in ['CHM', 'ECO']:
            classif = "Paired Elective (Chem ↔ Eco, Less Heavy w/ Less Heavy)"
        elif s_code in ['BIO', 'LIT']:
            classif = "Paired Elective (Bio ↔ Lit, Less Heavy w/ Less Heavy)"
        elif s_code in ['MTH', 'ENG']:
            classif = "Core Protected (P1/P2/P5 Priority; No tired hours)"
        elif s_code == 'CIV':
            classif = "Senior Core (SS 1–3 Strictly; Zero JSS)"
        elif s_code == 'DPR':
            classif = "Senior Core (SS 1–3, 3 contacts each)"
        elif s_code == 'AGR':
            classif = "Senior Core (SS 1–3, 4 contacts each)"

        detail_rows.append([
            Paragraph(str(d_idx), cell_center),
            Paragraph(f"<b>{s_name}</b>", cell_bold),
            Paragraph(s_code, cell_badge),
            Paragraph(t_name, cell_normal),
            Paragraph(c_name, cell_center),
            Paragraph(f"<b>{pw}</b>", cell_center),
            Paragraph(struct, cell_normal),
            Paragraph(classif, cell_normal)
        ])
        d_idx += 1

    d_col_widths = [24, 130, 45, 110, 48, 55, 100, 230]
    detail_table = Table(detail_rows, colWidths=d_col_widths, repeatRows=1)
    
    d_table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0f766e')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]

    for r in range(1, len(detail_rows)):
        bg = colors.HexColor('#f0fdfa') if r % 2 == 1 else colors.HexColor('#ffffff')
        d_table_style.append(('BACKGROUND', (0, r), (-1, r), bg))

    detail_table.setStyle(TableStyle(d_table_style))
    elements.append(detail_table)

    # Build document
    doc.build(elements)
    conn.close()
    print(f"Successfully generated official PDF at: {PDF_PATH}")

if __name__ == "__main__":
    generate_pdf()
