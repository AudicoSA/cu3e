"""
CAPS Foundation Phase Maths starter pack — one-shot seeder.

Generates 10 worksheets (Grades 1-2 Maths), renders each to a PDF via
reportlab, uploads to Supabase Storage under curriculum/library/, and
inserts a curriculum_library row per pack with extracted_text already
populated so activation is instant and skips the Claude vision call.

Run from the website-app directory:
    python3 scripts/seed_caps_foundation.py

Requires:
    pip install reportlab requests

Env (read from .env.local):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import io
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

# ---------------------------------------------------------------------------
# Content — keep each worksheet small, focused, age-appropriate.
# Question format mirrors the extracted-text shape Echo expects:
#   Qa: ... / Q1: ... so the in-chat progress bar counts correctly.
# ---------------------------------------------------------------------------

WORKSHEETS = [
    {
        "id": "caps-g1-counting-to-20",
        "grade": "Grade 1",
        "title": "Counting to 20",
        "description": "Count and write the number. Building confidence with 1-20.",
        "intro": "Count carefully. Use your fingers if you need to.",
        "questions": [
            "Count the apples: 🍎🍎🍎🍎🍎. How many?",
            "Count the stars: ⭐⭐⭐⭐⭐⭐⭐⭐. How many?",
            "Count the fish: 🐟🐟🐟🐟🐟🐟🐟🐟🐟🐟🐟🐟. How many?",
            "Write the number that comes after 7.",
            "Write the number that comes before 15.",
            "Fill the missing number: 11, 12, ___, 14, 15.",
            "Fill the missing number: 17, 18, ___, 20.",
            "Count backwards from 10: 10, 9, 8, ___, ___, ___, ___, ___, ___, 1.",
            "Which number is bigger: 13 or 19?",
            "Which number is smaller: 6 or 4?",
        ],
    },
    {
        "id": "caps-g1-skip-counting-2s",
        "grade": "Grade 1",
        "title": "Skip Counting in 2s",
        "description": "Counting in twos to 30. Building rhythm + early multiplication sense.",
        "intro": "Count in 2s. Say each one out loud.",
        "questions": [
            "Fill in: 2, 4, ___, 8, 10.",
            "Fill in: 2, 4, 6, 8, 10, ___, ___, ___, ___, 20.",
            "Count in 2s up to 14: 2, 4, ___, ___, ___, ___, ___.",
            "What comes after 18 when counting in 2s?",
            "Fill in: 10, 12, 14, ___, 18, ___.",
            "Fill in: 20, 22, ___, ___, 28, 30.",
            "Start from 6 and count in 2s: 6, 8, ___, ___, ___.",
            "Count the pairs of shoes for 5 people. (Hint: skip count in 2s)",
            "How many fingers on 4 hands? (skip count in 5s)",
            "Even numbers from 0 to 10: 0, 2, ___, ___, ___, 10.",
        ],
    },
    {
        "id": "caps-g1-skip-counting-5s",
        "grade": "Grade 1",
        "title": "Skip Counting in 5s",
        "description": "Counting in fives to 50. Pattern recognition with money + time.",
        "intro": "Count in 5s. The numbers go up by 5 each time.",
        "questions": [
            "Fill in: 5, 10, ___, 20, 25.",
            "Fill in: 5, 10, 15, ___, ___, ___, 35.",
            "Count in 5s up to 50: 5, 10, ___, ___, ___, ___, ___, 40, 45, 50.",
            "What comes after 25 when counting in 5s?",
            "How many 5s make 20?",
            "Fingers on 6 hands: count in 5s.",
            "Start from 15 and count in 5s: 15, 20, ___, ___, ___.",
            "Backwards in 5s from 30: 30, 25, ___, ___, ___, ___, 0.",
            "R5 coins to make R25 — how many coins?",
            "Five minutes past five each step: 5, 10, 15, 20, ___, ___.",
        ],
    },
    {
        "id": "caps-g1-skip-counting-10s",
        "grade": "Grade 1",
        "title": "Skip Counting in 10s",
        "description": "Counting in tens to 100. The decade structure underneath everything.",
        "intro": "Count in 10s. Each step adds 10.",
        "questions": [
            "Fill in: 10, 20, ___, 40, 50.",
            "Fill in: 10, 20, 30, ___, ___, 60, ___, 80, 90, 100.",
            "How many 10s make 100?",
            "Start from 30: 30, 40, ___, ___, 70.",
            "Backwards in 10s from 100: 100, 90, ___, ___, 60.",
            "How many R10 notes make R50?",
            "Children in 5 classes, 10 each — how many children?",
            "Stack 10 blocks 4 times — how many blocks?",
            "What comes before 70 when counting in 10s?",
            "Fill in: 50, ___, 70, ___, 90, ___.",
        ],
    },
    {
        "id": "caps-g1-adding-within-10",
        "grade": "Grade 1",
        "title": "Adding within 10",
        "description": "Single-digit addition with sums up to 10. Foundation of arithmetic.",
        "intro": "Add the numbers. Use your fingers or counters if it helps.",
        "questions": [
            "3 + 4 = ?",
            "5 + 2 = ?",
            "1 + 6 = ?",
            "4 + 4 = ?",
            "7 + 2 = ?",
            "0 + 8 = ?",
            "3 + 6 = ?",
            "2 + 5 = ?",
            "Sam has 4 marbles. He gets 5 more. How many in total?",
            "There are 6 birds in a tree. 2 more come. How many now?",
        ],
    },
    {
        "id": "caps-g1-subtracting-within-10",
        "grade": "Grade 1",
        "title": "Subtracting within 10",
        "description": "Single-digit subtraction. Taking away, finding the difference.",
        "intro": "Take away. Cross out objects to help if you need to.",
        "questions": [
            "7 − 2 = ?",
            "9 − 4 = ?",
            "10 − 5 = ?",
            "8 − 3 = ?",
            "6 − 6 = ?",
            "5 − 0 = ?",
            "10 − 7 = ?",
            "9 − 1 = ?",
            "Lerato had 8 sweets. She ate 3. How many are left?",
            "There were 10 ducks. 4 flew away. How many are left?",
        ],
    },
    {
        "id": "caps-g1-number-bonds-10",
        "grade": "Grade 1",
        "title": "Number Bonds to 10",
        "description": "Pairs of numbers that make 10. Critical fluency for all later maths.",
        "intro": "Find the missing partner that makes 10.",
        "questions": [
            "1 + ___ = 10",
            "2 + ___ = 10",
            "3 + ___ = 10",
            "4 + ___ = 10",
            "5 + ___ = 10",
            "6 + ___ = 10",
            "7 + ___ = 10",
            "8 + ___ = 10",
            "9 + ___ = 10",
            "0 + ___ = 10",
        ],
    },
    {
        "id": "caps-g1-bigger-or-smaller",
        "grade": "Grade 1",
        "title": "Bigger or Smaller",
        "description": "Comparing numbers up to 50. Building number-sense and place value.",
        "intro": "Which number is bigger? Use < (smaller) or > (bigger) if you know them.",
        "questions": [
            "Bigger: 12 or 17?",
            "Bigger: 30 or 25?",
            "Smaller: 8 or 14?",
            "Smaller: 22 or 21?",
            "Bigger: 40 or 38?",
            "Order from smallest to biggest: 9, 3, 15, 6, 11.",
            "Order from biggest to smallest: 22, 8, 14, 30, 17.",
            "Is 20 closer to 15 or to 30?",
            "Is 17 closer to 10 or to 20?",
            "Which is in the middle of 10 and 20?",
        ],
    },
    {
        "id": "caps-g2-times-tables-2s-5s-10s",
        "grade": "Grade 2",
        "title": "Times Tables — 2s, 5s, 10s",
        "description": "First multiplication. Skip-counting becomes multiplying.",
        "intro": "Skip count to find the answer.",
        "questions": [
            "3 × 2 = ?",
            "5 × 2 = ?",
            "4 × 5 = ?",
            "6 × 5 = ?",
            "3 × 10 = ?",
            "7 × 10 = ?",
            "8 × 2 = ?",
            "2 × 5 = ?",
            "9 × 10 = ?",
            "5 × 5 = ?",
        ],
    },
    {
        "id": "caps-g2-place-value-tens-ones",
        "grade": "Grade 2",
        "title": "Place Value — Tens and Ones",
        "description": "Numbers up to 99 broken into tens and ones.",
        "intro": "A number like 34 is 3 tens and 4 ones.",
        "questions": [
            "How many tens in 27?",
            "How many ones in 27?",
            "How many tens in 50?",
            "Write 4 tens and 6 ones as a number.",
            "Write 7 tens and 2 ones as a number.",
            "Break 85 into tens and ones.",
            "Break 19 into tens and ones.",
            "What number is 2 tens more than 35?",
            "What number is 1 ten less than 50?",
            "Write 9 tens and 9 ones as a number.",
        ],
    },
]


def build_extracted_text(ws: dict) -> str:
    """Produce the extracted_text string in the shape Echo expects.

    Mirrors what /api/extract-pdf would produce — one Q<label>: per
    question. That way the in-chat per-curriculum progress bar
    (which counts Q-labels) works out of the box, and Echo can
    refer to specific questions by label naturally.
    """
    lines = [
        f"{ws['title']} — {ws['grade']}",
        ws["intro"],
        "",
    ]
    for i, q in enumerate(ws["questions"], start=1):
        lines.append(f"Q{i}: {q}")
    return "\n".join(lines)


def build_pdf(ws: dict) -> bytes:
    """Render the worksheet to a single-page A4 PDF as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title=ws["title"],
        author="CU3E",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "h1", parent=styles["Heading1"], fontSize=18, leading=22,
        textColor="#0d1638", spaceAfter=4,
    )
    sub = ParagraphStyle(
        "sub", parent=styles["Normal"], fontSize=10, leading=14,
        textColor="#6f7480", spaceAfter=12,
    )
    intro = ParagraphStyle(
        "intro", parent=styles["Normal"], fontSize=11, leading=16,
        textColor="#2a2f3f", spaceAfter=16, fontName="Helvetica-Oblique",
    )
    q = ParagraphStyle(
        "q", parent=styles["Normal"], fontSize=11.5, leading=18,
        textColor="#1a1f30", spaceAfter=10, leftIndent=6,
    )

    story = [
        Paragraph(ws["title"], h1),
        Paragraph(f"{ws['grade']} · CAPS Foundation Phase · CU3E", sub),
        Paragraph(ws["intro"], intro),
    ]
    for i, qtext in enumerate(ws["questions"], start=1):
        story.append(Paragraph(f"<b>Q{i}.</b> &nbsp; {qtext}", q))
        story.append(Spacer(1, 4))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Supabase plumbing
# ---------------------------------------------------------------------------

def load_env() -> dict:
    """Read NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local."""
    here = Path(__file__).resolve().parent.parent
    env_path = here / ".env.local"
    env: dict = {}
    if not env_path.exists():
        sys.exit(f"missing {env_path}")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    for k in required:
        if k not in env:
            sys.exit(f"missing env var {k} in .env.local")
    return env


def upload_pdf(env: dict, storage_path: str, pdf_bytes: bytes) -> None:
    """PUT the PDF to the curriculum bucket, overwriting if it exists."""
    url = (
        f"{env['NEXT_PUBLIC_SUPABASE_URL']}/storage/v1/object/curriculum/"
        + urllib.parse.quote(storage_path)
    )
    req = urllib.request.Request(
        url,
        data=pdf_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        # 'Duplicate' = file already exists; we set x-upsert so this shouldn't
        # happen, but if it does we treat as success.
        if e.code == 409 or "Duplicate" in body:
            return
        sys.exit(f"upload failed for {storage_path}: {e.code} {body[:200]}")


def upsert_library_row(env: dict, ws: dict, storage_path: str) -> None:
    """Insert / update the curriculum_library row for this worksheet.

    Uses PostgREST's on_conflict resolution via a synthetic UNIQUE on
    (region, grade, title) — but since that constraint doesn't exist,
    we delete-then-insert by title within the CAPS+grade combo. Simpler:
    DELETE matching rows then INSERT.
    """
    base = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/curriculum_library"
    headers = {
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    extracted = build_extracted_text(ws)
    payload = {
        "region": "CAPS",
        "grade": ws["grade"],
        "subject": "Mathematics",
        "title": ws["title"],
        "description": ws["description"],
        "storage_path": storage_path,
        "source_attribution": "CU3E Foundation Phase pack",
        "page_count": 1,
        "is_published": True,
        "extracted_text": extracted,
        "question_count": len(ws["questions"]),
    }

    # Delete by title+region+grade so re-running this script keeps the
    # library tidy.
    del_url = (
        f"{base}?region=eq.CAPS"
        f"&grade=eq.{urllib.parse.quote(ws['grade'])}"
        f"&title=eq.{urllib.parse.quote(ws['title'])}"
    )
    del_req = urllib.request.Request(del_url, method="DELETE", headers=headers)
    try:
        urllib.request.urlopen(del_req, timeout=15).read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        # 404 = nothing to delete, fine.
        if e.code not in (404,):
            print(f"  warn: delete returned {e.code} {body[:120]}", file=sys.stderr)

    ins_req = urllib.request.Request(
        base,
        data=json.dumps(payload).encode(),
        method="POST",
        headers=headers,
    )
    try:
        urllib.request.urlopen(ins_req, timeout=15).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"insert failed for {ws['id']}: {e.code} {e.read().decode(errors='replace')[:200]}")


def main() -> None:
    env = load_env()
    print(f"Seeding {len(WORKSHEETS)} CAPS Foundation Phase worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        upsert_library_row(env, ws, storage_path)
        print(f"  ✓ {ws['grade']} · {ws['title']} ({len(ws['questions'])} Qs, {len(pdf)} bytes)")
    print("Done. Library packs available in the Study Hub for any logged-in parent.")


if __name__ == "__main__":
    main()
