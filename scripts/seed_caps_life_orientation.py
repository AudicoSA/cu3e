"""
CAPS Life Skills (G1-3) / Life Orientation (G4-9) pack — one-shot seeder.

CAPS calls it "Life Skills" in Foundation + Intermediate Phase, and
"Life Orientation" in Senior Phase. Covers personal wellbeing, social
skills, health, safety, civic awareness, and careers. ~28 worksheets
covering G1-9.

Run:
    python3 scripts/seed_caps_life_orientation.py
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

SUBJECT = "Life Skills"

WORKSHEETS = [
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 1-3
    # ------------------------------------------------------------------
    {
        "id": "caps-lo-g1-feelings",
        "grade": "Grade 1",
        "title": "My Feelings",
        "description": "Naming what you feel - the first step in managing it.",
        "intro": "Feelings are like weather inside us. Happy, sad, angry, scared, excited - all normal. Naming the feeling helps you handle it.",
        "questions": [
            "Name 4 different feelings.",
            "What's the opposite of 'happy'?",
            "What's the opposite of 'angry'?",
            "How does your body feel when you are happy?",
            "How does your body feel when you are scared?",
            "What can you do when you feel angry?",
            "Who can you talk to when you feel sad?",
            "When did you last feel really happy?",
            "Is it okay to cry? Why?",
            "Draw or describe your face when you're EXCITED.",
        ],
    },
    {
        "id": "caps-lo-g1-family-roles",
        "grade": "Grade 1",
        "title": "My Family and Helpers",
        "description": "Who's in my family. Who looks after me.",
        "intro": "Families come in many shapes. Some kids live with two parents, some with one, some with grandparents. All are families.",
        "questions": [
            "Who lives in your house?",
            "Who helps cook your food?",
            "Who helps you when you are sick?",
            "Who takes you to school?",
            "Name one chore YOU do at home.",
            "What's a 'guardian'? (someone who looks after you)",
            "Are all families the same?",
            "What makes a family special?",
            "What is one rule in your house?",
            "What's something you love doing with your family?",
        ],
    },
    {
        "id": "caps-lo-g1-healthy-habits",
        "grade": "Grade 1",
        "title": "Healthy Habits",
        "description": "What you do every day to stay strong and well.",
        "intro": "Eat well. Drink water. Wash your hands. Brush your teeth. Sleep enough. Play and move.",
        "questions": [
            "How many times a day should you brush your teeth?",
            "When should you wash your hands? (give 3 times)",
            "Name 3 healthy foods.",
            "Name 3 foods you should eat ONLY sometimes (treats).",
            "How many hours of sleep do kids need? (10-12)",
            "Why is drinking water important?",
            "Why is exercise important?",
            "What happens if you don't brush your teeth?",
            "Name a way to keep your skin clean.",
            "Tell me ONE healthy habit you do every day.",
        ],
    },
    {
        "id": "caps-lo-g2-safety",
        "grade": "Grade 2",
        "title": "Safety at Home and School",
        "description": "Safe people, safe places, safe behaviour.",
        "intro": "Safety means avoiding things that can hurt you, and knowing what to do if something bad happens.",
        "questions": [
            "What number do you call in an emergency in SA? (10111 = police, 10177 = ambulance)",
            "Should you open the door to a stranger when home alone?",
            "Where should you cross the road?",
            "Why should you wear a seatbelt?",
            "What do you do if your clothes catch fire? (stop, drop, roll)",
            "Is it safe to play with matches? Why not?",
            "What's a 'safe adult'? (someone you trust)",
            "Name 2 safe adults in your life.",
            "What do you do if a stranger offers you sweets?",
            "What's the rule about strangers and the internet?",
        ],
    },
    {
        "id": "caps-lo-g2-friendship",
        "grade": "Grade 2",
        "title": "Making Friends and Being Kind",
        "description": "What a real friend is.",
        "intro": "Friends are people who care about you and you care about them. Real friends are kind even when no one's watching.",
        "questions": [
            "Name 3 qualities of a good friend.",
            "What does 'kind' mean?",
            "What do you do if a friend is sad?",
            "What do you do if a friend hurts your feelings?",
            "Is it okay to have only 1 friend?",
            "What's 'sharing'?",
            "What's 'taking turns'?",
            "Is it kind to laugh AT someone? (no - laugh WITH them)",
            "Why is it good to say sorry when you've been unkind?",
            "Tell me one kind thing you did this week.",
        ],
    },
    {
        "id": "caps-lo-g3-rights-responsibilities",
        "grade": "Grade 3",
        "title": "Rights and Responsibilities",
        "description": "What you DESERVE + what you must DO.",
        "intro": "Every child has the RIGHT to safety, food, school, family. With rights come responsibilities: doing your chores, following rules.",
        "questions": [
            "Name 2 rights that every child has.",
            "Name 2 responsibilities a child has.",
            "Is education a right or a privilege?",
            "Is having a clean room your right or your responsibility?",
            "What does 'fairness' mean?",
            "If you have the right to play, what's your responsibility about sharing toys?",
            "What's the difference between a 'right' and a 'wish'?",
            "Who protects children's rights in SA? (government, families, schools)",
            "What is your responsibility at school?",
            "Name a chore you SHOULD do at home but sometimes forget.",
        ],
    },
    {
        "id": "caps-lo-g3-hygiene",
        "grade": "Grade 3",
        "title": "Personal Hygiene",
        "description": "Keeping yourself clean = keeping germs away.",
        "intro": "Germs are tiny things that can make you sick. Washing, brushing, bathing keep them off your body.",
        "questions": [
            "How long should you wash your hands? (20 seconds — Happy Birthday song x2)",
            "Why use soap, not just water?",
            "How often should you bath/shower?",
            "Why brush teeth in the morning AND night?",
            "What's a germ?",
            "Name a way germs spread.",
            "Why should you cover your mouth when you sneeze?",
            "Why don't you share toothbrushes?",
            "Why wash hands BEFORE eating?",
            "Why wash hands AFTER the toilet?",
        ],
    },
    {
        "id": "caps-lo-g3-feelings-managing",
        "grade": "Grade 3",
        "title": "Managing Big Feelings",
        "description": "What to do when feelings get too big to handle alone.",
        "intro": "Big feelings happen — anger, sadness, frustration. There are TOOLS for managing them. Calm body = calm mind.",
        "questions": [
            "What's deep breathing? Why does it help?",
            "Try: breathe in 4 seconds, hold 4, out 4. How do you feel?",
            "If you feel angry, what can you do INSTEAD of hitting?",
            "If you feel sad, name 2 things that might help.",
            "Who can you talk to when feelings get too big?",
            "What's a 'tantrum'? Why do they happen?",
            "What's the difference between feeling angry and ACTING angry?",
            "Is it okay to feel jealous sometimes?",
            "Name 3 calming activities (e.g. drawing, music, hugging a pet).",
            "What's ONE feeling you find hard to handle? What might help?",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4-6
    # ------------------------------------------------------------------
    {
        "id": "caps-lo-g4-self-esteem",
        "grade": "Grade 4",
        "title": "Self-Esteem and Self-Worth",
        "description": "Knowing your worth - it doesn't come from likes or grades.",
        "intro": "Self-esteem = how you see yourself. High self-esteem doesn't mean thinking you're better than others - it means knowing you ARE enough.",
        "questions": [
            "What is self-esteem?",
            "Name 3 things you're good at.",
            "Name 3 things you'd like to be better at.",
            "Is it healthy to compare yourself to others all the time?",
            "What's 'inner voice'? (the way you talk to yourself in your head)",
            "Is your inner voice usually kind or mean?",
            "What can you say to yourself when you make a mistake?",
            "Does failing at something mean you're a failure?",
            "Who in your life believes in you?",
            "Write ONE kind thing you can say to yourself this week.",
        ],
    },
    {
        "id": "caps-lo-g4-peer-pressure",
        "grade": "Grade 4",
        "title": "Peer Pressure",
        "description": "When friends push you to do things you're not sure about.",
        "intro": "Peer = someone your age. Peer pressure = being pushed by friends to do/wear/say things. Can be good or bad.",
        "questions": [
            "What is 'peer pressure'?",
            "Give an example of GOOD peer pressure.",
            "Give an example of BAD peer pressure.",
            "Why might it be hard to say 'no' to friends?",
            "What's a polite way to say 'no'?",
            "What's a 'real friend' who won't push you?",
            "If friends are making fun of someone, what would YOU do?",
            "Is it okay to walk away from a friend group sometimes?",
            "Name ONE thing you would NEVER do even if friends pressured you.",
            "Who could you tell if peer pressure feels scary?",
        ],
    },
    {
        "id": "caps-lo-g4-healthy-food",
        "grade": "Grade 4",
        "title": "Healthy Food Choices",
        "description": "Food groups, balance, and what to eat for energy.",
        "intro": "5 food groups: starches, proteins, fruits, vegetables, fats. A balanced plate has all 5. Sugar + processed food = sometimes only.",
        "questions": [
            "Name the 5 main food groups.",
            "Give 2 examples of starches.",
            "Give 2 examples of proteins.",
            "Give 2 examples of fruits.",
            "Give 2 examples of vegetables.",
            "Why is water better than sugary drinks?",
            "What does 'processed food' mean?",
            "Name a healthy breakfast.",
            "How much sugar should kids have per day? (very little!)",
            "Plan a healthy lunch for tomorrow.",
        ],
    },
    {
        "id": "caps-lo-g5-bullying",
        "grade": "Grade 5",
        "title": "Bullying - What to Do",
        "description": "Recognise it, stop it, report it.",
        "intro": "Bullying = repeated, unwanted, harmful behaviour. Can be physical, verbal, or online (cyberbullying). Never your fault.",
        "questions": [
            "What is bullying?",
            "Name 3 types of bullying.",
            "What's cyberbullying?",
            "If you are bullied, who should you tell?",
            "Is it 'snitching' to report bullying?",
            "If you see someone being bullied, what can you do?",
            "Why do bullies bully? (often: insecurity, jealousy, copying)",
            "Is fighting back the best response?",
            "What's a 'bystander'? An 'upstander'?",
            "Write down one phrase you could say to a bully (e.g. 'Stop. That's not okay.').",
        ],
    },
    {
        "id": "caps-lo-g5-puberty-intro",
        "grade": "Grade 5",
        "title": "Growing Up - Changes in Your Body",
        "description": "Puberty is normal. It happens to everyone, in their own time.",
        "intro": "Puberty = when your body starts changing from a child's into a teenager's. Usually starts age 8-13 (varies a lot). Both boys and girls go through it differently.",
        "questions": [
            "What is puberty?",
            "When does it usually start?",
            "Does everyone go through it at the same time?",
            "Name 2 changes for girls (e.g. breast development, periods).",
            "Name 2 changes for boys (e.g. voice deepening, body hair).",
            "Is puberty something to be embarrassed about?",
            "Who can you talk to with questions about puberty?",
            "Are mood swings normal during puberty?",
            "What's a 'period' / menstruation? (the monthly cycle for girls)",
            "Is it okay to ask grown-ups awkward questions? (Yes!)",
        ],
    },
    {
        "id": "caps-lo-g5-citizenship",
        "grade": "Grade 5",
        "title": "Being a Good Citizen",
        "description": "Your part in your community + country.",
        "intro": "Citizen = a member of a country/community. Good citizens follow laws, care for others, and protect the environment.",
        "questions": [
            "What is a 'citizen'?",
            "Name 2 things a good citizen does.",
            "What does it mean to 'respect the law'?",
            "How can a child help the environment? (3 ideas)",
            "What's 'democracy'? (people vote for leaders)",
            "When can SA citizens vote? (age 18)",
            "Name one right SA citizens have.",
            "Name one responsibility SA citizens have.",
            "What does 'community' mean?",
            "Name something YOU could do to help your community.",
        ],
    },
    {
        "id": "caps-lo-g6-decision-making",
        "grade": "Grade 6",
        "title": "Making Good Decisions",
        "description": "Think first. Choose well.",
        "intro": "Every day has decisions. The grown-up way: pause, think about consequences, choose what's right - not just what's easy.",
        "questions": [
            "What does 'decision' mean?",
            "Name a decision you made today.",
            "What does 'consequence' mean?",
            "Should you decide WHEN you're angry? Why not?",
            "What's 'thinking it through'?",
            "Name a HARD decision a kid your age might face.",
            "What's a 'short-term' vs 'long-term' consequence?",
            "If you're stuck, who can help you decide?",
            "Is the easy choice always the right choice?",
            "Describe a recent decision and what you thought about before making it.",
        ],
    },
    {
        "id": "caps-lo-g6-emotional-intelligence",
        "grade": "Grade 6",
        "title": "Emotional Intelligence",
        "description": "Understanding YOUR feelings + OTHERS' feelings.",
        "intro": "EQ = emotional intelligence. It's noticing feelings (yours + theirs), managing your reactions, and responding well. Just as important as IQ.",
        "questions": [
            "What does 'EQ' stand for?",
            "What is 'empathy'?",
            "What does it mean to 'put yourself in someone else's shoes'?",
            "How can you tell what someone is feeling? (face, body, words)",
            "Why is it useful to notice your OWN feelings?",
            "What's the difference between REACTING and RESPONDING?",
            "When you're tired or hungry, your emotions feel BIGGER. True or false?",
            "Name a person who you think has high EQ. Why?",
            "Can you learn to be more emotionally intelligent? (Yes!)",
            "Name ONE thing you'll practise this week (e.g. listening, pausing before reacting).",
        ],
    },
    {
        "id": "caps-lo-g6-environment",
        "grade": "Grade 6",
        "title": "Caring for the Environment",
        "description": "Your daily choices matter.",
        "intro": "Reduce, Reuse, Recycle. Less plastic. Save water. Save electricity. Plant trees. The earth is the only home we have.",
        "questions": [
            "What does the 3 R's stand for? (Reduce, Reuse, Recycle)",
            "Name 3 things you can recycle.",
            "Why is plastic a problem? (long to break down, kills marine life)",
            "Name a way to save water at home.",
            "Name a way to save electricity at home.",
            "What's a 'carbon footprint'?",
            "Why are trees important? (clean air, oxygen, shade, homes for animals)",
            "What's 'climate change'?",
            "What can ONE person do to help the environment? (lots!)",
            "Pick ONE thing you'll start doing differently this week.",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7-9 (Life Orientation)
    # ------------------------------------------------------------------
    {
        "id": "caps-lo-g7-identity",
        "grade": "Grade 7",
        "title": "Identity - Who Am I?",
        "description": "Building a sense of self that's all yours.",
        "intro": "Identity = the bundle of things that make YOU you: values, interests, beliefs, culture, personality. Not what others say you are.",
        "questions": [
            "What is 'identity'?",
            "Name 3 things that make you YOU.",
            "What's a 'value'? (something you believe is important, e.g. honesty)",
            "Name 2 of your values.",
            "Does your identity change as you grow? (yes - and that's healthy)",
            "Is it okay to think differently from your friends?",
            "What's a 'role model'?",
            "Name one of your role models. Why?",
            "What's the difference between 'who you are' and 'what others think of you'?",
            "Write 3 things you LIKE about yourself.",
        ],
    },
    {
        "id": "caps-lo-g7-relationships",
        "grade": "Grade 7",
        "title": "Healthy Relationships",
        "description": "With family, friends, and (eventually) partners.",
        "intro": "Healthy = mutual respect, trust, kindness, honest communication. Unhealthy = control, fear, secrets, put-downs.",
        "questions": [
            "Name 3 signs of a HEALTHY relationship.",
            "Name 3 signs of an UNHEALTHY relationship.",
            "What is 'consent'?",
            "Is it okay to say NO to a hug if you don't want one?",
            "What does 'boundary' mean in a relationship?",
            "What should you do if someone makes you uncomfortable?",
            "Are jealous controlling behaviours 'love'? Why not?",
            "Who can you talk to about confusing feelings?",
            "What's 'trust'? How is it built?",
            "Write down ONE quality you want in your friendships.",
        ],
    },
    {
        "id": "caps-lo-g7-online-safety",
        "grade": "Grade 7",
        "title": "Online Safety + Digital Footprint",
        "description": "What you post stays. What you click matters.",
        "intro": "Your digital footprint = everything you do online. Once it's out there, it's permanent. Treat the internet like a microphone in front of millions.",
        "questions": [
            "What is a 'digital footprint'?",
            "Why are passwords important?",
            "What makes a STRONG password?",
            "Is it safe to share your address or phone number online?",
            "What is 'catfishing'?",
            "What do you do if a stranger messages you online?",
            "Why is screenshot 'forever' even if you delete?",
            "What's 'phishing'? (a scam that tricks you into giving info)",
            "Name a rule for what you'll NEVER post.",
            "How does scrolling affect your mood? (notice it)",
        ],
    },
    {
        "id": "caps-lo-g8-careers",
        "grade": "Grade 8",
        "title": "Exploring Careers",
        "description": "What you might want to BE one day.",
        "intro": "Careers are paths, not single jobs. Most adults change careers 3-5 times. Start by noticing what you LOVE and what you're GOOD at.",
        "questions": [
            "What is a 'career'?",
            "Name 5 different careers.",
            "What career does your mom/dad/guardian have?",
            "Name something YOU love doing.",
            "Name something you're GOOD at.",
            "What's the difference between a career and a job?",
            "Do you need a degree for every career?",
            "What's an 'apprenticeship'? (learn-while-you-work)",
            "Name a career that helps people.",
            "Name a career that didn't EXIST 20 years ago (e.g. social media manager, AI engineer, app developer).",
        ],
    },
    {
        "id": "caps-lo-g8-substance-abuse",
        "grade": "Grade 8",
        "title": "Substance Abuse - The Honest Picture",
        "description": "Drugs and alcohol - what they do, why they're dangerous.",
        "intro": "Substance abuse = using drugs, alcohol, or other substances in ways that harm you. Many start young - it's harder to quit than to never start.",
        "questions": [
            "What does 'substance abuse' mean?",
            "Name 3 substances people abuse (alcohol, nicotine, drugs).",
            "Why is alcohol especially harmful to developing brains?",
            "What's 'addiction'?",
            "Why is it easier to NEVER start than to quit?",
            "Name 3 reasons people might start using substances.",
            "What's a healthy way to deal with stress?",
            "What's a healthy way to deal with feeling left out?",
            "Who can you talk to if you're feeling pressured?",
            "Name a SA helpline for substance issues (SADAG: 0800-456-789).",
        ],
    },
    {
        "id": "caps-lo-g8-conflict",
        "grade": "Grade 8",
        "title": "Conflict Resolution",
        "description": "How to disagree without fighting.",
        "intro": "Conflict = a disagreement. Handled well, it can make relationships stronger. Handled badly, it breaks them.",
        "questions": [
            "What is 'conflict'?",
            "Is all conflict bad?",
            "Name 3 healthy ways to handle conflict.",
            "Name 3 UNHEALTHY ways (yelling, hitting, ghosting).",
            "What's 'active listening'? (really hearing the other person)",
            "What's an 'I statement'? (e.g. 'I feel hurt when...')",
            "Why is 'You always...' a bad way to start?",
            "What's a 'compromise'?",
            "When should you ask an adult to help?",
            "Describe a small recent conflict and how you handled it.",
        ],
    },
    {
        "id": "caps-lo-g9-mental-health",
        "grade": "Grade 9",
        "title": "Mental Health Basics",
        "description": "Your mind needs care just like your body.",
        "intro": "Mental health = how you think, feel, and act. Like physical health, it can be strong or weak. Both can be improved.",
        "questions": [
            "What is mental health?",
            "Is mental health different from mental illness?",
            "Name 3 things that support good mental health.",
            "Name 3 things that DAMAGE it.",
            "What's 'anxiety'? Is it the same as fear?",
            "What's 'depression'? Is it just being sad?",
            "Is it weak to ask for help with mental health?",
            "Who can a teenager talk to? (parent, teacher, school counsellor, GP, helpline)",
            "Name a SA mental health helpline (SADAG: 0800-456-789).",
            "What's ONE thing you do that supports your mental health?",
        ],
    },
    {
        "id": "caps-lo-g9-sexuality-rights",
        "grade": "Grade 9",
        "title": "Sexuality, Consent, and Rights",
        "description": "Knowledge is protection.",
        "intro": "Your body is yours. Consent must be enthusiastic, free, given without pressure. South African law sets the age of consent at 16.",
        "questions": [
            "What is 'consent'?",
            "Must consent be enthusiastic, or is silence okay? (must be enthusiastic)",
            "What is the legal age of consent in SA?",
            "If someone is drunk or pressured, can they truly consent?",
            "Is sexual harassment a crime in SA? (yes)",
            "What is 'sexual orientation'?",
            "Are LGBTQ+ rights protected in the SA Constitution? (yes)",
            "Who can a teen talk to about sexuality questions?",
            "What is 'safe sex'?",
            "Name a SA support line for sexual abuse (Childline: 116).",
        ],
    },
    {
        "id": "caps-lo-g9-future-planning",
        "grade": "Grade 9",
        "title": "Planning Your Future - Subject Choices",
        "description": "Decisions you make now shape your options later.",
        "intro": "End of Grade 9 = subject-choice time for Grade 10. Maths or Maths Lit? Sciences? Languages? Choose based on STRENGTHS + INTERESTS + future paths.",
        "questions": [
            "What's the difference between Maths and Maths Literacy?",
            "Why does subject choice matter?",
            "Are some subjects REQUIRED for university?",
            "What career do you currently think you might want?",
            "What subjects link to it?",
            "Should you choose subjects based on what your friends choose?",
            "Should you choose subjects ONLY because they're easy?",
            "Who can help you choose? (parents, teachers, school counsellor)",
            "What's a 'gap year'?",
            "Name 2 things you could do AFTER Matric (university, college, TVET, apprenticeship, work, gap year).",
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
        "source_attribution": "CU3E CAPS Life Skills / Life Orientation pack",
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
    print(f"Seeding {len(WORKSHEETS)} CAPS Life Skills worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        upload_pdf(env, storage_path, build_pdf(ws))
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} Life Skills packs in the Study Hub library.")


if __name__ == "__main__":
    main()
