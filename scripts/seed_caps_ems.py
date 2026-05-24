"""
CAPS Economic & Management Sciences pack — Grades 7-9.

EMS is taught in Senior Phase (G7-9). Covers: money basics, savings,
budgeting, business basics, basic accounting, the economy.

~12 worksheets covering G7-9.

Run:
    python3 scripts/seed_caps_ems.py
"""

import io
import json
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

SUBJECT = "Economic and Management Sciences"

WORKSHEETS = [
    {
        "id": "caps-ems-g7-money",
        "grade": "Grade 7",
        "title": "Money - What Is It, Really?",
        "description": "Why we use money, and where it came from.",
        "intro": "Before money, people bartered (swapped goods). Money is a tool that makes trading easier. Today it's mostly digital.",
        "questions": [
            "What did people use BEFORE money? (barter)",
            "Why is money better than barter?",
            "Name 3 forms money has taken (shells, coins, notes, cards, digital).",
            "What's the SA currency?",
            "What's a 'cent'? How many in a rand?",
            "What does the bank do with your money?",
            "What's 'inflation'?",
            "Why does inflation reduce buying power?",
            "What's 'currency' (give a non-rand example)?",
            "Why do prices change over time?",
        ],
    },
    {
        "id": "caps-ems-g7-needs-wants",
        "grade": "Grade 7",
        "title": "Needs vs Wants",
        "description": "Knowing the difference is the first money skill.",
        "intro": "NEEDS = things you can't live without (food, water, shelter, clothing, education). WANTS = things you'd LIKE (latest phone, snacks, entertainment).",
        "questions": [
            "Define 'need'.",
            "Define 'want'.",
            "Is food a need or a want?",
            "Is a smartphone a need or a want? (Mostly want - depends on use)",
            "Is electricity a need or a want?",
            "Is fast food a need or a want?",
            "Is education a need or a want?",
            "List 3 things you've bought this month - which were needs?",
            "Why do advertisers try to turn wants into 'needs'?",
            "Name a 'want' you decided NOT to buy. Why?",
        ],
    },
    {
        "id": "caps-ems-g7-budgeting",
        "grade": "Grade 7",
        "title": "Budgeting - Where Does Your Money Go?",
        "description": "A budget = a plan for your money.",
        "intro": "Budget = income (money in) - expenses (money out). The trick: spend less than you earn, and SAVE the difference.",
        "questions": [
            "What is a 'budget'?",
            "What are 'fixed expenses'? (same every month - rent, school fees)",
            "What are 'variable expenses'? (vary - food, entertainment)",
            "What's 'discretionary spending'? (treats, non-essentials)",
            "If you earn R500 and spend R600, what happens?",
            "If you earn R500 and spend R300, what can you do with R200?",
            "What does it mean to 'live within your means'?",
            "Why is it important to budget for unexpected expenses?",
            "How much of your income should you try to save? (10-20% is healthy)",
            "Make a tiny budget: R100 pocket money. Save how much? Spend on what?",
        ],
    },
    {
        "id": "caps-ems-g7-saving",
        "grade": "Grade 7",
        "title": "Saving and Compound Interest",
        "description": "The earlier you start, the more it grows.",
        "intro": "Saving = setting money aside. The MAGIC: compound interest. Money you save earns interest. That interest THEN earns interest. Over years, it explodes.",
        "questions": [
            "What does it mean to 'save'?",
            "Where can you save money? (bank, savings account, piggy bank)",
            "What is 'interest'?",
            "What is 'compound interest'?",
            "If you save R100 at 10% per year, after 1 year you have? (R110)",
            "After 2 years (compound)? (R121)",
            "Why is starting young much better than starting late?",
            "What's a 'savings account'?",
            "What's an 'emergency fund'?",
            "Name 3 things you might save FOR.",
        ],
    },
    {
        "id": "caps-ems-g8-business-basics",
        "grade": "Grade 8",
        "title": "How a Business Works",
        "description": "Inputs, outputs, costs, revenue, profit.",
        "intro": "Business = creating something people want, selling it for more than it cost you. Revenue - Costs = Profit.",
        "questions": [
            "What is a 'business'?",
            "What are 'inputs'? (what you spend to make something)",
            "What are 'outputs'? (what you make/sell)",
            "What is 'revenue'? (money coming in from sales)",
            "What are 'costs'? (money going out)",
            "What is 'profit'?",
            "What is 'loss'?",
            "If a business makes R5000 revenue and has R3000 costs, what's the profit?",
            "What's a 'small business'?",
            "Name 3 small businesses in your community.",
        ],
    },
    {
        "id": "caps-ems-g8-entrepreneurship",
        "grade": "Grade 8",
        "title": "Entrepreneurship",
        "description": "What it takes to start something.",
        "intro": "Entrepreneur = someone who starts and runs a business. SA has many entrepreneurs because formal jobs are scarce. Risk + opportunity.",
        "questions": [
            "What is an 'entrepreneur'?",
            "Name 3 qualities of a good entrepreneur.",
            "Why do many SA people start their own businesses?",
            "What's a 'risk'? Why is starting a business risky?",
            "What's an 'opportunity'?",
            "Name a SA entrepreneur you've heard of.",
            "What's a 'business plan'?",
            "What's 'startup capital'? (the money you need to start)",
            "What's a 'customer'?",
            "If you started a business tomorrow, what would it sell?",
        ],
    },
    {
        "id": "caps-ems-g8-banking",
        "grade": "Grade 8",
        "title": "Banks and Banking",
        "description": "How banks make money + how to use them wisely.",
        "intro": "Banks take in deposits + lend the money out at HIGHER interest. The difference is their profit. They also charge fees + process transactions.",
        "questions": [
            "Name 3 SA banks.",
            "What's a 'deposit'?",
            "What's a 'withdrawal'?",
            "What's a 'savings account'?",
            "What's a 'current account' (or 'cheque account')?",
            "How does a bank make money?",
            "What's a 'loan'?",
            "What's 'interest' from your side (when you borrow)?",
            "What's a 'debit card' vs a 'credit card'?",
            "What's 'overdraft'?",
        ],
    },
    {
        "id": "caps-ems-g8-accounting-basics",
        "grade": "Grade 8",
        "title": "Basic Accounting - Income + Expenses",
        "description": "Tracking money in and out, properly.",
        "intro": "Accounting = the system of recording money. INCOME = money in. EXPENSES = money out. The result tells you if you're winning or losing.",
        "questions": [
            "What is 'accounting'?",
            "What is 'income'?",
            "What is an 'expense'?",
            "What's 'net income'? (Income - Expenses)",
            "If income = R10 000 and expenses = R8000, what's net income?",
            "If expenses > income, what's that called? (loss / negative)",
            "What's a 'receipt'? Why keep them?",
            "What's a 'ledger'? (a record of transactions)",
            "Why do businesses have to file tax returns?",
            "What is 'SARS'? (South African Revenue Service)",
        ],
    },
    {
        "id": "caps-ems-g9-economic-systems",
        "grade": "Grade 9",
        "title": "Economic Systems",
        "description": "Capitalism, socialism, mixed economies.",
        "intro": "Capitalism = private ownership + markets decide prices. Socialism = state ownership + state controls. Most countries (incl. SA) = MIXED.",
        "questions": [
            "What's 'capitalism'?",
            "What's 'socialism'?",
            "What's a 'mixed economy'?",
            "Is SA capitalist, socialist, or mixed? (mixed)",
            "Who decides prices in a free market?",
            "What's 'supply and demand'?",
            "Name an industry the SA government owns (or used to). (Eskom, SAA, Transnet)",
            "What's 'privatisation'?",
            "What's 'nationalisation'?",
            "Why do some people prefer capitalism? Why do others prefer socialism?",
        ],
    },
    {
        "id": "caps-ems-g9-supply-demand",
        "grade": "Grade 9",
        "title": "Supply and Demand",
        "description": "The fundamental law of market prices.",
        "intro": "When demand > supply, prices RISE. When supply > demand, prices FALL. Markets find balance through price.",
        "questions": [
            "What is 'demand'?",
            "What is 'supply'?",
            "If a fruit is scarce + everyone wants it, what happens to its price?",
            "If there's too much fruit and no one wants it, what happens?",
            "What's 'equilibrium price'? (where supply = demand)",
            "Why does petrol get more expensive when oil supply shrinks?",
            "Why do strawberry prices drop in summer?",
            "What's a 'shortage'?",
            "What's a 'surplus'?",
            "Apply: load shedding reduces electricity SUPPLY. What does that do to prices longer-term?",
        ],
    },
    {
        "id": "caps-ems-g9-financial-literacy",
        "grade": "Grade 9",
        "title": "Financial Literacy for Teens",
        "description": "What every teen should know about money.",
        "intro": "Most adults learn this too late. Start now: save consistently, avoid debt traps, understand fees, compound interest is your best friend.",
        "questions": [
            "What's the difference between 'good debt' and 'bad debt'?",
            "Why are credit cards risky?",
            "What's a 'minimum payment' on a credit card - is paying ONLY the minimum good?",
            "What does 'budget' really mean in 1 sentence?",
            "What's an 'asset'? (something that GAINS value or earns income)",
            "What's a 'liability'? (something that LOSES value or costs you)",
            "Is a car an asset or a liability? (Tricky - depreciates + costs money)",
            "Is education an asset or a liability?",
            "Name 3 ways to grow money long-term (invest in shares, property, education).",
            "What's ONE financial habit you'll start now?",
        ],
    },
    {
        "id": "caps-ems-g9-sa-economy",
        "grade": "Grade 9",
        "title": "The SA Economy - Strengths and Challenges",
        "description": "Where SA stands economically.",
        "intro": "SA = upper-middle-income country. Strong sectors: mining, agriculture, tourism, finance. Big challenges: inequality, unemployment, corruption.",
        "questions": [
            "Is SA classified as 'developing' or 'developed'?",
            "Name 3 of SA's strong sectors.",
            "What does SA export? (gold, platinum, fruit, wine, cars)",
            "What does SA import? (oil, machinery, electronics)",
            "What's the SA unemployment rate (roughly)? (~30%)",
            "What's the 'Gini coefficient'? (SA has one of the world's highest = high inequality)",
            "What's 'corruption'? Why is it harmful?",
            "What's 'load shedding'? Why does it hurt the economy?",
            "What's the 'informal sector'? (street traders, taxi drivers, etc.)",
            "Name ONE thing that could improve SA's economy.",
        ],
    },
]


def build_extracted_text(ws: dict) -> str:
    lines = [f"{ws['title']} - {ws['grade']}", ws["intro"], ""]
    for i, q in enumerate(ws["questions"], start=1):
        lines.append(f"Q{i}: {q}")
    return "\n".join(lines)


def build_pdf(ws: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title=ws["title"], author="CU3E",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, leading=22,
                        textColor="#0d1638", spaceAfter=4)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, leading=14,
                         textColor="#6f7480", spaceAfter=12)
    intro = ParagraphStyle("intro", parent=styles["Normal"], fontSize=11, leading=16,
                           textColor="#2a2f3f", spaceAfter=16, fontName="Helvetica-Oblique")
    q = ParagraphStyle("q", parent=styles["Normal"], fontSize=11.5, leading=18,
                       textColor="#1a1f30", spaceAfter=10, leftIndent=6)
    story = [
        Paragraph(ws["title"], h1),
        Paragraph(f"{ws['grade']} - CAPS - CU3E", sub),
        Paragraph(ws["intro"].replace("\n", "<br/>"), intro),
    ]
    for i, qtext in enumerate(ws["questions"], start=1):
        story.append(Paragraph(f"<b>Q{i}.</b> &nbsp; {qtext}", q))
        story.append(Spacer(1, 4))
    doc.build(story)
    return buf.getvalue()


def load_env() -> dict:
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
    for k in ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]:
        if k not in env:
            sys.exit(f"missing env var {k} in .env.local")
    return env


def upload_pdf(env: dict, storage_path: str, pdf_bytes: bytes) -> None:
    url = (f"{env['NEXT_PUBLIC_SUPABASE_URL']}/storage/v1/object/curriculum/"
           + urllib.parse.quote(storage_path))
    req = urllib.request.Request(
        url, data=pdf_bytes, method="POST",
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
        if e.code == 409 or "Duplicate" in body:
            return
        sys.exit(f"upload failed for {storage_path}: {e.code} {body[:200]}")


def wipe_existing_rows(env: dict) -> int:
    base = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/curriculum_library"
    headers = {
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Prefer": "return=representation",
    }
    subject_param = urllib.parse.quote(SUBJECT)
    req = urllib.request.Request(
        f"{base}?region=eq.CAPS&subject=eq.{subject_param}",
        method="DELETE", headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return len(json.loads(r.read() or b"[]"))
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if e.code in (404,):
            return 0
        sys.exit(f"wipe failed: {e.code} {body[:200]}")


def insert_library_row(env: dict, ws: dict, storage_path: str) -> None:
    base = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/curriculum_library"
    headers = {
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    payload = {
        "region": "CAPS", "grade": ws["grade"], "subject": SUBJECT,
        "title": ws["title"], "description": ws["description"],
        "storage_path": storage_path,
        "source_attribution": "CU3E CAPS EMS pack",
        "page_count": 1, "is_published": True,
        "extracted_text": build_extracted_text(ws),
        "question_count": len(ws["questions"]),
    }
    req = urllib.request.Request(
        base, data=json.dumps(payload).encode(),
        method="POST", headers=headers,
    )
    try:
        urllib.request.urlopen(req, timeout=15).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"insert failed for {ws['id']}: {e.code} {e.read().decode(errors='replace')[:200]}")


def main() -> None:
    env = load_env()
    print(f"Wiping existing CAPS {SUBJECT} rows from library...")
    print(f"  removed {wipe_existing_rows(env)} stale rows")
    print(f"Seeding {len(WORKSHEETS)} CAPS EMS worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        upload_pdf(env, storage_path, build_pdf(ws))
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} EMS packs in the Study Hub library.")


if __name__ == "__main__":
    main()
