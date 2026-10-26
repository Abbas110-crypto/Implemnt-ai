from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"C:\Users\UNI-TECH\Documents\Codex\2026-10-20\this-is-my-project-link-c")
OUTPUT = ROOT / "outputs" / "client_four_bug_findings.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#14233B")
BLUE = colors.HexColor("#315BE8")
MUTED = colors.HexColor("#596579")
LINE = colors.HexColor("#E3E8F0")
PALE = colors.HexColor("#F7F9FD")

styles = {
    "title": ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=18, leading=22,
        textColor=NAVY, spaceAfter=4,
    ),
    "subtitle": ParagraphStyle(
        "subtitle", fontName="Helvetica", fontSize=9, leading=13,
        textColor=MUTED, spaceAfter=18,
    ),
    "card_title": ParagraphStyle(
        "card_title", fontName="Helvetica-Bold", fontSize=10.5, leading=14,
        textColor=NAVY, spaceAfter=5,
    ),
    "body": ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9, leading=13.5,
        textColor=NAVY, alignment=TA_LEFT,
    ),
    "label": ParagraphStyle(
        "label", fontName="Helvetica-Bold", fontSize=8.5, leading=12,
        textColor=BLUE,
    ),
    "note": ParagraphStyle(
        "note", fontName="Helvetica", fontSize=8.5, leading=12.5,
        textColor=MUTED,
    ),
}


def make_card(number, title, finding, impact):
    content = [
        Paragraph(f"{number}. {title}", styles["card_title"]),
        Paragraph(f"<b>Code finding:</b> {finding}", styles["body"]),
        Spacer(1, 4),
        Paragraph(f"<b>Impact:</b> {impact}", styles["body"]),
    ]
    card = Table([[content]], colWidths=[174 * mm])
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([card, Spacer(1, 9)])


def footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 17 * mm, width - 18 * mm, 17 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 12 * mm, "Implemnt - original code review | 20 October 2026")
    canvas.drawRightString(width - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=19 * mm, bottomMargin=23 * mm,
)
frame = Frame(
    doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
    leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
)
doc.addPageTemplates(PageTemplate(id="summary", frames=[frame], onPage=footer))

story = [
    Paragraph("Four Reported Bugs: Code Findings", styles["title"]),
    Paragraph("Concise client summary based on review of the original application source.", styles["subtitle"]),
    make_card(
        1, "Missing call transcripts",
        "A call record is created before transcription may be ready. If the later transcript event finds no data, the handler acknowledges it without scheduling a retry. Manual recovery checks only the latest 50 completed bots.",
        "Some call records can remain without transcripts even when the transcript becomes available later.",
    ),
    make_card(
        2, "Unreliable calendar connection",
        "The code listens for 'calendar.updated', while Recall sends 'calendar.update'. It can therefore miss disconnection notices. Reauthorization creates another calendar record rather than reconciling the existing one.",
        "Connection status can become stale, and duplicate records can make the calendar appear inconsistent.",
    ),
    make_card(
        3, "Missing or delayed Monday.com updates",
        "The backend OAuth path requests read-only board access although the workflow performs write operations. The workflow does not verify the status mutation response and searches only a limited set of boards and items.",
        "An update may be skipped or rejected while the application still reports success. Late transcripts can also delay processing.",
    ),
    make_card(
        4, "Bot not joining a scheduled meeting",
        "The scheduler processes only the first page of calendar events, skips events processed after their start time, and does not retry failed scheduling requests.",
        "An eligible meeting can remain without a scheduled bot. The bot ID is also read from the wrong response field, reducing tracking accuracy.",
    ),
    Spacer(1, 3),
    Paragraph("Verification status", styles["label"]),
    Spacer(1, 4),
    Paragraph(
        "These are confirmed failure paths in the code, not proof of the precise cause of each historical incident. "
        "Provider delivery logs, API responses, and end-to-end checks are required before claiming that every incident is resolved.",
        styles["note"],
    ),
]

doc.build(story)
print(OUTPUT)
