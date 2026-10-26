from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


ROOT = Path(r"C:\Users\UNI-TECH\Documents\Codex\2026-10-20\this-is-my-project-link-c")
OUTPUT = ROOT / "outputs" / "client_bug_and_migration_report.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

navy = colors.HexColor("#172744")
blue = colors.HexColor("#315BE8")
muted = colors.HexColor("#596579")
line = colors.HexColor("#DCE3EF")
pale = colors.HexColor("#F5F8FE")

title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=navy, spaceAfter=5)
subtitle = ParagraphStyle("subtitle", fontName="Helvetica", fontSize=9, leading=13, textColor=muted, spaceAfter=15)
heading = ParagraphStyle("heading", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=navy, spaceBefore=14, spaceAfter=7)
body = ParagraphStyle("body", fontName="Helvetica", fontSize=8.8, leading=12.6, textColor=navy)
small = ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=11.5, textColor=muted)
header = ParagraphStyle("header", fontName="Helvetica-Bold", fontSize=8.8, leading=12, textColor=colors.white)
issue = ParagraphStyle("issue", fontName="Helvetica-Bold", fontSize=9, leading=12.5, textColor=navy)


def footer(canvas, doc):
    canvas.saveState()
    w, _ = A4
    canvas.setStrokeColor(line)
    canvas.line(17 * mm, 16 * mm, w - 17 * mm, 16 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(muted)
    canvas.drawString(17 * mm, 11 * mm, "Implemnt | Source-code review | 26 October 2026")
    canvas.drawRightString(w - 17 * mm, 11 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm,
    topMargin=18 * mm, bottomMargin=23 * mm,
)

rows = [
    [Paragraph("Client issue", header), Paragraph("Finding in the original Base44 code", header)],
    [Paragraph("1. Missing transcripts", issue), Paragraph(
        "<b>recallCalendarWebhook:</b> <b>bot.done</b> inserts a CallLog before transcription is necessarily complete. "
        "On <b>transcript.done</b>, an empty transcript returns HTTP 200 with 'transcript still empty', so that delivery is treated as handled. "
        "<b>syncRecallCalls</b> fetches only 50 completed bots, does not follow the next page, and identifies existing calls by title and date rather than bot ID.", body)],
    [Paragraph("2. Calendar connection", issue), Paragraph(
        "<b>recallCalendarWebhook</b> compares the event name to <b>calendar.updated</b>; Recall sends <b>calendar.update</b>. "
        "The disconnect/status branch therefore does not run for the documented event. "
        "<b>recallCalendarOAuth</b> always creates a new Recall calendar and local record after authorization; it does not update an existing connection.", body)],
    [Paragraph("3. Monday.com updates", issue), Paragraph(
        "<b>mondayOAuth</b> requests <b>boards:read</b> in its authorization path, while <b>processCallRiskToMonday</b> calls "
        "<b>create_update</b> and <b>change_simple_column_value</b>. The status mutation's HTTP/GraphQL result is not checked before "
        "returning <b>monday_updated: true</b>. Item matching scans only 20 boards and 100 items per board by company name; "
        "missing client IDs or connections cause early skips.", body)],
    [Paragraph("4. Bot missing meetings", issue), Paragraph(
        "On <b>calendar.sync_events</b>, the handler processes only <b>eventsData.results</b> and never follows the pagination URL. "
        "It skips an event when <b>start_time &lt;= now</b>. A failed scheduling POST is added to 'skipped', but the webhook still "
        "returns HTTP 200 with no retry. On success, <b>botData.id</b> is recorded as the bot ID although the response's bot ID "
        "is under <b>bots[].bot_id</b>; that last defect affects tracking.", body)],
]

table = Table(rows, colWidths=[49 * mm, 127 * mm], repeatRows=1, hAlign="LEFT")
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), navy),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, pale]),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), 0.5, line),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))

story = [
    Paragraph("Integration Issues and Migration Benefits", title),
    Paragraph("Technical client report | Original Base44 application and proposed Supabase + Vercel setup", subtitle),
    table,
    Paragraph("Benefits of moving to the local project, then Vercel", heading),
    Paragraph(
        "<b>Data isolation:</b> A separate Supabase database and per-user access rules isolate development records from the live Base44 database.<br/>"
        "<b>Recoverable processing:</b> The local backend includes webhook receipts, persisted bot/event states, paginated event fetching, "
        "and a reconciliation function for missed calendar events and transcripts.<br/>"
        "<b>Clear hosting roles:</b> Vercel serves the frontend; Supabase runs authentication, database, webhooks, and server functions. "
        "The local call analysis uses explicit rules rather than Base44 AI.", body),
    Spacer(1, 13),
    Paragraph(
        "<b>Verification boundary:</b> These are source-code failure paths, not proof of the cause of any specific historical incident. "
        "The new deployment must be configured and checked with real OAuth connections, webhooks, completed calls, and Monday updates "
        "before it can be presented as fully resolved.", small),
]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
