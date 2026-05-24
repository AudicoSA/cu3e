"""
CAPS Creative Arts pack — Grades 4-9.

Creative Arts in CAPS covers four strands across G4-9:
  - Visual Art
  - Music
  - Drama
  - Dance

~13 worksheets across G4-9. Inquiry + appreciation focus (kids do the
HANDS-ON part in person; worksheets give them concepts + history).

Run:
    python3 scripts/seed_caps_creative_arts.py
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

SUBJECT = "Creative Arts"

WORKSHEETS = [
    # GRADE 4
    {
        "id": "caps-arts-g4-colour-shape",
        "grade": "Grade 4",
        "title": "Visual Art - Colour and Shape",
        "description": "The two starting blocks of any picture.",
        "intro": "Colour can be PRIMARY (red, yellow, blue) or mixed. Shapes are everywhere: circles, squares, triangles - and FREE shapes too.",
        "questions": [
            "Name the 3 primary colours.",
            "Red + Yellow = ?",
            "Blue + Yellow = ?",
            "Red + Blue = ?",
            "What 'mood' does the colour BLUE often suggest? (calm, cold)",
            "What 'mood' does RED suggest? (energy, danger, love)",
            "Name a GEOMETRIC shape.",
            "Name an ORGANIC shape. (like a leaf or cloud)",
            "Why do artists use both shapes + colours together?",
            "What's your favourite colour? Why?",
        ],
    },
    {
        "id": "caps-arts-g4-rhythm-beat",
        "grade": "Grade 4",
        "title": "Music - Rhythm and Beat",
        "description": "The pulse behind every song.",
        "intro": "BEAT = the steady pulse. RHYTHM = the pattern of long + short sounds OVER the beat. Together they make music move.",
        "questions": [
            "What's the 'beat' of a song?",
            "What's 'rhythm'?",
            "Tap a steady beat with your hand. Now tap a rhythm. What's different?",
            "What's 'tempo'? (speed of beat)",
            "Name a fast-tempo song you know.",
            "Name a slow-tempo song.",
            "Name an instrument that keeps the beat (drums).",
            "Why do dance + music go together?",
            "Clap a rhythm: clap-clap-pause-clap-clap-clap. How many sounds?",
            "Make up your OWN rhythm with claps.",
        ],
    },
    # GRADE 5
    {
        "id": "caps-arts-g5-portraits",
        "grade": "Grade 5",
        "title": "Visual Art - Portraits and Self-Portraits",
        "description": "Drawing the human face.",
        "intro": "A portrait is a picture of a person. A self-portrait is a picture of YOURSELF. Famous artists like Van Gogh + Frida Kahlo painted many self-portraits.",
        "questions": [
            "What's a 'portrait'?",
            "What's a 'self-portrait'?",
            "Where is the centre of the face (vertically)?",
            "Where are the eyes (horizontally)?",
            "What artist is famous for self-portraits with a bandaged ear?",
            "Name a SA portrait artist you've heard of (or just guess one).",
            "What does a portrait try to capture besides looks? (personality)",
            "Why is drawing yourself harder than drawing someone else?",
            "What expression would you choose for YOUR self-portrait?",
            "Try: draw yourself in a simple shape (oval head, lines for features).",
        ],
    },
    {
        "id": "caps-arts-g5-drama-roles",
        "grade": "Grade 5",
        "title": "Drama - Roles and Character",
        "description": "Playing someone else - the heart of acting.",
        "intro": "Drama = telling a story through performance. A 'role' is the character you play. Good actors think about: how their character feels, moves, talks.",
        "questions": [
            "What is 'drama'?",
            "What does 'character' mean in drama?",
            "What's a 'monologue'? (one person speaking)",
            "What's a 'dialogue'? (two people)",
            "How do you show 'angry' WITHOUT shouting? (face, body)",
            "How do you show 'scared'?",
            "What's 'improvisation'? (making it up as you go)",
            "Name a famous play or movie character.",
            "What's a 'protagonist'? (the main character)",
            "What's an 'antagonist'? (the opposing character)",
        ],
    },
    # GRADE 6
    {
        "id": "caps-arts-g6-perspective",
        "grade": "Grade 6",
        "title": "Visual Art - Perspective",
        "description": "Making a flat picture look 3D.",
        "intro": "Perspective = how artists make things look CLOSER or FURTHER. One key tool: the vanishing point (a single point where lines meet on the horizon).",
        "questions": [
            "What is 'perspective' in art?",
            "What's the 'horizon line'?",
            "What's a 'vanishing point'?",
            "Do near or far objects look BIGGER?",
            "Do near or far objects appear sharper or blurrier?",
            "Why do railway tracks appear to meet in the distance?",
            "What's 'foreground'? (near)",
            "What's 'background'? (far)",
            "What did Renaissance artists discover about perspective?",
            "Try: draw a road that gets smaller as it goes further away.",
        ],
    },
    {
        "id": "caps-arts-g6-music-instruments",
        "grade": "Grade 6",
        "title": "Music - Instrument Families",
        "description": "The 4 main groups: strings, wind, brass, percussion.",
        "intro": "All musical instruments fit into a FAMILY. Strings = vibrate when plucked/bowed. Wind = blown. Brass = lip vibration. Percussion = hit.",
        "questions": [
            "Name the 4 instrument families.",
            "Is a violin a string or percussion?",
            "Is a flute string, wind, brass, or percussion?",
            "Is a trumpet wind or brass?",
            "Is a drum percussion or string?",
            "Name 2 string instruments.",
            "Name 2 wind instruments.",
            "Name 2 brass instruments.",
            "Name 2 percussion instruments.",
            "What SA traditional instrument can you think of? (mbira, marimba, djembe, vuvuzela)",
        ],
    },
    # GRADE 7
    {
        "id": "caps-arts-g7-african-art",
        "grade": "Grade 7",
        "title": "Visual Art - African Art and Identity",
        "description": "From rock paintings to modern SA artists.",
        "intro": "African art has a long history - from San rock art (10,000+ years) to today's SA artists like Esther Mahlangu (Ndebele) and William Kentridge.",
        "questions": [
            "Name an early form of African art. (rock art)",
            "Who are the San? (early SA people who made rock art)",
            "What is 'Ndebele' painting known for? (bold geometric patterns)",
            "Name a famous SA artist. (Esther Mahlangu, William Kentridge, Irma Stern)",
            "Why is African art important globally?",
            "What materials might traditional African art use? (clay, beads, fabric, paint)",
            "What's 'cultural identity'?",
            "Can art tell a story without words?",
            "Does art have to be 'pretty' to be 'good'?",
            "What's ONE thing you'd want to express through art?",
        ],
    },
    {
        "id": "caps-arts-g7-dance-types",
        "grade": "Grade 7",
        "title": "Dance - Styles Around the World",
        "description": "Movement as expression.",
        "intro": "Dance is in every culture. Ballet (Europe), Indian classical, African tribal, hip-hop (American), gumboot (SA mining communities).",
        "questions": [
            "What's 'dance'?",
            "Where does ballet come from?",
            "What's special about Indian classical dance? (storytelling through hands)",
            "What's gumboot dance? (SA origin, made on mines)",
            "What's hip-hop dance?",
            "What's 'choreography'?",
            "Why is dance often connected to music?",
            "Can dance tell a story without words?",
            "Name a SA dance style.",
            "What dance would YOU love to learn?",
        ],
    },
    # GRADE 8
    {
        "id": "caps-arts-g8-art-history",
        "grade": "Grade 8",
        "title": "Visual Art - Art Movements Through Time",
        "description": "Renaissance, Impressionism, Modern Art.",
        "intro": "Art has gone through 'movements'. Renaissance (~1400-1600): realism + perspective. Impressionism (~1870s): light + colour. Modern (1900+): rebels broke all the rules.",
        "questions": [
            "What was the 'Renaissance'?",
            "Name a Renaissance artist. (da Vinci, Michelangelo, Raphael)",
            "What were Impressionists known for?",
            "Name an Impressionist. (Monet, Renoir, Degas)",
            "What's 'Modern Art'?",
            "Name a Modern artist. (Picasso, Matisse, Pollock)",
            "What's 'abstract' art?",
            "Why did Modern artists break traditional rules?",
            "Is 'Modern' the same as 'contemporary'? (No - contemporary = today)",
            "Which movement appeals to YOU most? Why?",
        ],
    },
    {
        "id": "caps-arts-g8-drama-improv",
        "grade": "Grade 8",
        "title": "Drama - Improvisation",
        "description": "Making it up on the spot.",
        "intro": "Improv = no script. You think + react + create AS YOU GO. The first rule of improv: 'Yes, and...' (accept + add).",
        "questions": [
            "What is 'improvisation'?",
            "What's the 'Yes, and' rule? Why does it matter?",
            "Why is improv good for confidence?",
            "What happens if you say 'No' in improv?",
            "What's 'status' in a scene? (who's higher / lower)",
            "What 3 things does an improv scene need? (character, place, problem)",
            "Why do mistakes in improv often become the BEST parts?",
            "Name a famous improv-based TV show.",
            "What's 'group mind' in improv?",
            "Try: imagine you're a chef who's just been told the customer is a celebrity. Act it out in your head.",
        ],
    },
    # GRADE 9
    {
        "id": "caps-arts-g9-art-criticism",
        "grade": "Grade 9",
        "title": "Visual Art - Looking at Art Critically",
        "description": "How to talk about art with depth.",
        "intro": "Art criticism has 4 stages: Describe -> Analyse -> Interpret -> Judge. Practise on any artwork.",
        "questions": [
            "What are the 4 stages of art criticism?",
            "What does 'describe' mean? (just what you SEE)",
            "What does 'analyse' mean? (how it's MADE - colour, line, composition)",
            "What does 'interpret' mean? (what it MEANS / makes you feel)",
            "What does 'judge' mean? (is it effective? successful?)",
            "Why shouldn't you 'judge' first?",
            "Is everyone's interpretation the same? Why or why not?",
            "What's 'composition'? (how elements are arranged)",
            "What's 'context'? (when + where + why was it made)",
            "Pick any artwork in your house. Describe it in 1 sentence.",
        ],
    },
    {
        "id": "caps-arts-g9-creating-original",
        "grade": "Grade 9",
        "title": "Creating Your Own Work",
        "description": "From idea -> sketch -> finished piece.",
        "intro": "Real artists don't wait for inspiration - they CREATE habits. Sketchbook every day. Bad drawings are part of the process. The 10,000-hour rule applies here too.",
        "questions": [
            "What's a 'sketchbook' for?",
            "Why is it important to make BAD art?",
            "What's the 10,000-hour rule?",
            "Where do artists get IDEAS?",
            "What's a 'mood board'?",
            "What's the difference between COPYING (bad) and STUDYING (good)?",
            "Why is finishing pieces important?",
            "What's 'artistic voice'?",
            "Who's an artist you'd love to learn from?",
            "Pick a project: 1 painting, 1 song, or 1 short skit. When will you start?",
        ],
    },
    {
        "id": "caps-arts-g9-arts-careers",
        "grade": "Grade 9",
        "title": "Careers in the Arts",
        "description": "It's a real career path - and there are more options than you think.",
        "intro": "Arts careers: designer, illustrator, musician, actor, animator, game designer, art teacher, curator, writer, filmmaker, photographer. Not just 'starving artist'.",
        "questions": [
            "Name 5 careers in the arts.",
            "What's an 'illustrator'?",
            "What's an 'animator'?",
            "What's a 'curator'?",
            "What's a 'graphic designer'?",
            "Do you need a degree to work in the arts? (sometimes; portfolio often matters more)",
            "What's a 'portfolio'?",
            "Name a SA in a creative career you've heard of.",
            "How has tech changed creative careers? (digital art, streaming, social media)",
            "If you could have any arts career, what would it be?",
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
        "source_attribution": "CU3E CAPS Creative Arts pack",
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
    print(f"Seeding {len(WORKSHEETS)} CAPS Creative Arts worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        upload_pdf(env, storage_path, build_pdf(ws))
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} Creative Arts packs in the Study Hub library.")


if __name__ == "__main__":
    main()
