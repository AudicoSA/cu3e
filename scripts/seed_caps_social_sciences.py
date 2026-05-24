"""
CAPS Social Sciences pack — Grades 4-9, one-shot seeder.

Social Sciences in CAPS covers two strands:
  - History (SA + world history)
  - Geography (maps, climate, environment, economy)

Both strands taught together G4-9. ~30-35 worksheets.

Run:
    python3 scripts/seed_caps_social_sciences.py
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

SUBJECT = "Social Sciences"

WORKSHEETS = [
    # ------------------------------------------------------------------
    # GRADE 4
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g4-geo-local",
        "grade": "Grade 4",
        "title": "Geography - My Local Area",
        "description": "Maps of where you live + key features.",
        "intro": "Geography starts at home. Streets, schools, shops, parks - all are 'features' on a map.",
        "questions": [
            "What is a map?",
            "Name 3 things you see on a map of your town.",
            "What's a 'key' / 'legend' on a map?",
            "What does 'N' stand for on a map?",
            "What's the 4 main compass directions?",
            "Name your town or city.",
            "Name the province you live in.",
            "Is your area urban (city), suburban (town), or rural (countryside)?",
            "Name a famous landmark near where you live.",
            "Draw or describe a simple map from your school to your home.",
        ],
    },
    {
        "id": "caps-soc-g4-hist-jobs",
        "grade": "Grade 4",
        "title": "History - Jobs Long Ago vs Today",
        "description": "How work has changed across generations.",
        "intro": "Once almost everyone farmed. Then factories came. Then offices. Now: many people work on computers from anywhere.",
        "questions": [
            "What job did MOST people have 200 years ago? (farming)",
            "What's the 'Industrial Revolution'?",
            "Name a job that didn't exist when your grandparents were young.",
            "Name a job that has DISAPPEARED (e.g. lamp-lighter, switchboard operator).",
            "What job does your parent/guardian have?",
            "What did THEIR parent do for work?",
            "What job would you like to have?",
            "Will that job still exist in 50 years?",
            "How has technology changed work?",
            "Name one job AI might do soon.",
        ],
    },
    {
        "id": "caps-soc-g4-geo-water",
        "grade": "Grade 4",
        "title": "Geography - Water in SA",
        "description": "Rivers, dams, oceans - and why water is precious.",
        "intro": "South Africa is a water-scarce country. Most of our water comes from rivers + dams + groundwater. Saving water = saving lives.",
        "questions": [
            "Is SA water-rich or water-scarce?",
            "Name the river that forms most of the border with Lesotho. (Orange)",
            "What's a 'dam'?",
            "Why was the Gariep Dam built?",
            "Name two oceans that touch SA. (Atlantic + Indian)",
            "Why don't we drink ocean water?",
            "What's a 'drought'?",
            "Name 3 ways to save water at home.",
            "What is 'water pollution'?",
            "Who does water shortages affect most?",
        ],
    },
    {
        "id": "caps-soc-g4-hist-san-khoi",
        "grade": "Grade 4",
        "title": "History - The First People of SA",
        "description": "San and Khoi - SA's earliest inhabitants.",
        "intro": "The San (hunters) and Khoi (herders) lived in southern Africa for tens of thousands of years before any other group arrived.",
        "questions": [
            "Who are the San?",
            "Who are the Khoi?",
            "Roughly how long have they been in southern Africa? (tens of thousands of years)",
            "Did they have written language? (No - oral)",
            "What is 'rock art'? Why is it important?",
            "Where can you see San rock art in SA?",
            "Did the San farm or hunt?",
            "What did the Khoi herd? (cattle)",
            "Why did their numbers shrink over centuries?",
            "Why is it important to remember the San and Khoi?",
        ],
    },
    # ------------------------------------------------------------------
    # GRADE 5
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g5-geo-sa-provinces",
        "grade": "Grade 5",
        "title": "Geography - SA's 9 Provinces",
        "description": "All 9 provinces, their capitals, and rough locations.",
        "intro": "SA has 9 provinces: Gauteng, Western Cape, Eastern Cape, KwaZulu-Natal, Northern Cape, Free State, North West, Mpumalanga, Limpopo.",
        "questions": [
            "How many provinces does SA have?",
            "Which province is the smallest by area? (Gauteng)",
            "Which is the LARGEST by area? (Northern Cape)",
            "Which province is Cape Town in?",
            "Which province is Durban in?",
            "Which province is Johannesburg in?",
            "Which province is Pretoria in? (Gauteng)",
            "Which province has the most people? (Gauteng)",
            "Which province borders Mozambique?",
            "Which province are YOU in?",
        ],
    },
    {
        "id": "caps-soc-g5-hist-ancient-egypt",
        "grade": "Grade 5",
        "title": "History - Ancient Egypt",
        "description": "Pyramids, pharaohs, the Nile.",
        "intro": "Ancient Egypt was one of the world's first great civilisations. Built around the Nile, lasted ~3000 years.",
        "questions": [
            "What river was Egyptian civilisation built around?",
            "Why was the river so important?",
            "Who was a 'pharaoh'?",
            "What are 'pyramids' used for?",
            "Name one famous pyramid. (Giza)",
            "What is a 'mummy'?",
            "What was 'hieroglyphics'? (their writing)",
            "Name one famous pharaoh. (Tutankhamun / Cleopatra / Ramses)",
            "What is the 'Rosetta Stone'?",
            "Why are pyramids still standing thousands of years later?",
        ],
    },
    {
        "id": "caps-soc-g5-geo-natural-disasters",
        "grade": "Grade 5",
        "title": "Geography - Natural Disasters",
        "description": "Floods, droughts, earthquakes, fires - what causes them.",
        "intro": "Natural disasters = severe natural events that cause damage. SA gets floods, droughts, and wildfires. Less common: earthquakes, tornadoes.",
        "questions": [
            "Name 3 types of natural disasters.",
            "What causes most floods?",
            "What causes a drought?",
            "Has SA had a recent drought? (Yes - Day Zero, Cape Town)",
            "What causes a wildfire?",
            "What's an earthquake? Why do they happen?",
            "Are tsunamis common in SA?",
            "What is 'climate change' and how does it affect disasters?",
            "What's an 'evacuation'?",
            "Name 2 things you should have in an emergency kit.",
        ],
    },
    {
        "id": "caps-soc-g5-hist-mfecane",
        "grade": "Grade 5",
        "title": "History - The Mfecane",
        "description": "A major shift in southern African history.",
        "intro": "The Mfecane (early 1800s) was a period of massive disruption + migration across southern Africa. Linked to Zulu kingdom's rise under Shaka.",
        "questions": [
            "What does 'Mfecane' mean? (crushing / scattering)",
            "Roughly when did it happen? (1810s-1830s)",
            "Who was Shaka Zulu?",
            "What kingdom did he build?",
            "What does 'migration' mean?",
            "Why did entire communities have to move?",
            "Did the Mfecane affect only one area? (No - across southern Africa)",
            "What happened to the Zulu kingdom AFTER Shaka?",
            "Why is the Mfecane debated by historians? (causes are complex)",
            "Is there evidence that drought played a part? (Yes - one theory)",
        ],
    },
    # ------------------------------------------------------------------
    # GRADE 6
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g6-geo-climate",
        "grade": "Grade 6",
        "title": "Geography - Climate and Weather Patterns",
        "description": "Why some places are hot, others cold, others wet.",
        "intro": "Climate is shaped by latitude (distance from equator), altitude, oceans, and wind. SA has diverse climates: from Mediterranean (Cape) to subtropical (Durban) to semi-arid (Karoo).",
        "questions": [
            "What's the difference between weather and climate?",
            "What climate does Cape Town have? (Mediterranean)",
            "What climate does Durban have? (subtropical / humid)",
            "What climate is the Karoo? (semi-arid / dry)",
            "What is the 'equator'?",
            "Why is it colder closer to the poles?",
            "What's 'altitude'? How does it affect climate?",
            "Why does Johannesburg get cold winters even though it's not far south?",
            "What's a 'rain shadow'?",
            "How does the ocean affect climate?",
        ],
    },
    {
        "id": "caps-soc-g6-hist-greece-rome",
        "grade": "Grade 6",
        "title": "History - Ancient Greece + Rome",
        "description": "The cradles of Western civilisation.",
        "intro": "Ancient Greece (~500 BC) invented democracy + philosophy. Rome (~300 BC - 400 AD) ruled a vast empire across Europe + North Africa.",
        "questions": [
            "What is 'democracy'? Where did it begin?",
            "Name a famous Greek philosopher. (Socrates / Plato / Aristotle)",
            "What's an 'empire'?",
            "What was the Roman Empire famous for?",
            "Name a famous Roman leader. (Caesar / Augustus / Nero)",
            "What language did the Romans speak? (Latin)",
            "Why are columns + arches still used in architecture?",
            "Name 2 Roman inventions still used today (concrete, sewage, calendar, laws).",
            "When did the Roman Empire fall? (476 AD - Western Empire)",
            "How did Greek/Roman ideas reach SA? (through Europe -> colonisation)",
        ],
    },
    {
        "id": "caps-soc-g6-geo-population",
        "grade": "Grade 6",
        "title": "Geography - Population and Cities",
        "description": "Where people live, and why.",
        "intro": "World population: ~8 billion. SA: ~62 million. Most people live in cities. Why? Jobs, services, infrastructure.",
        "questions": [
            "What's the world's population (roughly)?",
            "SA's population (roughly)?",
            "What is 'urbanisation'?",
            "Why do people move to cities?",
            "What's an 'informal settlement'?",
            "What's 'population density'?",
            "Which province has the highest density?",
            "Name 3 services that cities provide.",
            "What are 'challenges' of city living? (overcrowding, pollution, jobs)",
            "What's the world's biggest city? (Tokyo / Delhi - depends on definition)",
        ],
    },
    {
        "id": "caps-soc-g6-hist-trade-routes",
        "grade": "Grade 6",
        "title": "History - Trade Routes + Exploration",
        "description": "How Europe + Asia + Africa connected.",
        "intro": "For thousands of years, traders carried goods across the world: silk from China, spices from India, gold from Africa. Routes like the Silk Road shaped history.",
        "questions": [
            "What was the 'Silk Road'?",
            "What goods were traded along it?",
            "Why did Europeans want a SEA route to Asia?",
            "Who was Bartolomeu Dias? (sailed around the Cape, 1488)",
            "Who was Vasco da Gama? (reached India by sea, 1498)",
            "What was the 'Spice Trade'?",
            "Why is Cape Town called the 'Tavern of the Seas'?",
            "Did trade always benefit both sides? (No - often unequal)",
            "What was the impact of trade on local SA people?",
            "Name one negative effect of European trade with Africa.",
        ],
    },
    # ------------------------------------------------------------------
    # GRADE 7
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g7-geo-map-skills",
        "grade": "Grade 7",
        "title": "Geography - Map Skills",
        "description": "Scale, contour lines, grid references, key features.",
        "intro": "Maps are powerful when you can read them. Scale tells you distance. Contour lines show height. Grid references give exact locations.",
        "questions": [
            "What is the 'scale' on a map?",
            "If 1cm = 1km, how many km is 5cm?",
            "What are 'contour lines'?",
            "Close-together contour lines mean steep or gentle?",
            "What is a 'grid reference'?",
            "What is 'latitude'? (lines that go east-west)",
            "What is 'longitude'? (lines that go north-south)",
            "Where is the equator (which latitude)?",
            "What is the 'Prime Meridian'?",
            "Why are maps useful in everyday life?",
        ],
    },
    {
        "id": "caps-soc-g7-hist-european-colonialism",
        "grade": "Grade 7",
        "title": "History - European Colonisation of Africa",
        "description": "How Europe carved up Africa in the 1800s.",
        "intro": "By 1900, almost all of Africa was colonised by European powers (Britain, France, Portugal, Belgium, Germany, etc.). Independence came mostly in the 1950s-1960s.",
        "questions": [
            "What does 'colonisation' mean?",
            "Roughly when did European powers carve up Africa? (1880s-1900)",
            "What was the 'Berlin Conference' (1884-85)?",
            "Which European country colonised SA's interior eventually? (Britain)",
            "Which country colonised Mozambique?",
            "Which colonised Angola?",
            "How were colonial borders drawn? (often ignoring African nations)",
            "Why is this a problem TODAY?",
            "When did most African countries become independent?",
            "What is 'decolonisation'?",
        ],
    },
    {
        "id": "caps-soc-g7-geo-natural-resources",
        "grade": "Grade 7",
        "title": "Geography - Natural Resources",
        "description": "What SA + the world depend on the earth for.",
        "intro": "Natural resources = things from the earth we use: minerals, water, soil, forests, fossil fuels. SA is RICH in minerals (gold, platinum, coal, diamonds).",
        "questions": [
            "What's a 'natural resource'?",
            "Name 3 minerals SA is famous for. (gold, platinum, coal, diamonds)",
            "What is 'mining'?",
            "How does mining affect the environment?",
            "What's a 'renewable' resource? (sun, wind, water)",
            "What's a 'non-renewable' resource? (oil, coal, minerals)",
            "Why is SA dependent on coal for electricity?",
            "What are the problems of relying on coal?",
            "Name 3 renewable energy sources.",
            "What's 'sustainability'?",
        ],
    },
    {
        "id": "caps-soc-g7-hist-slavery",
        "grade": "Grade 7",
        "title": "History - Slavery and the Atlantic Trade",
        "description": "A dark chapter that shaped 3 continents.",
        "intro": "From the 1500s-1800s, millions of Africans were forcibly taken across the Atlantic to be slaves in the Americas. Slavery existed at the Cape too, until abolition in 1834.",
        "questions": [
            "What was the 'Atlantic slave trade'?",
            "Roughly how many Africans were taken? (~12 million across centuries)",
            "What was the 'Middle Passage'?",
            "Where were enslaved people taken? (Americas + Caribbean)",
            "Who profited?",
            "Did slavery exist at the Cape too? (Yes)",
            "When was slavery abolished in the British Empire? (1834)",
            "What lasting effects does slavery have today?",
            "What is 'reparations'?",
            "Why is it important to learn this history honestly?",
        ],
    },
    # ------------------------------------------------------------------
    # GRADE 8
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g8-geo-economic-geography",
        "grade": "Grade 8",
        "title": "Geography - Economic Geography",
        "description": "Why some places are rich, others poor.",
        "intro": "Economic geography = where money + jobs are concentrated. Wealth depends on resources, education, government, infrastructure, history.",
        "questions": [
            "Name 3 things that make a country wealthy.",
            "Is SA a 'developed' or 'developing' country?",
            "What is GDP?",
            "Why are cities richer than rural areas?",
            "What's 'inequality'?",
            "Why does SA have very high inequality?",
            "Name 2 ways to reduce inequality.",
            "What is 'unemployment'?",
            "Why is unemployment high in SA? (~30%)",
            "Name one industry SA depends on.",
        ],
    },
    {
        "id": "caps-soc-g8-hist-french-revolution",
        "grade": "Grade 8",
        "title": "History - The French Revolution",
        "description": "Liberty, equality, fraternity - and bloodshed.",
        "intro": "The French Revolution (1789-1799) overthrew the monarchy and reshaped political thought. It introduced the ideals of LIBERTY, EQUALITY, FRATERNITY (brotherhood).",
        "questions": [
            "When was the French Revolution?",
            "What 3 words capture its ideals?",
            "Who was overthrown? (King Louis XVI)",
            "What was the 'Bastille'?",
            "What does 'storming the Bastille' symbolise?",
            "What was the 'guillotine'?",
            "What was the 'Reign of Terror'?",
            "Who was Napoleon? How did he rise to power?",
            "How did the Revolution influence the world?",
            "Did the Revolution achieve its ideals? (Mixed - inspired future change)",
        ],
    },
    {
        "id": "caps-soc-g8-geo-development",
        "grade": "Grade 8",
        "title": "Geography - Development and Sustainability",
        "description": "Growing economies without destroying the planet.",
        "intro": "Development = improving living standards. But traditional development often damaged the environment. Sustainable development = meeting today's needs WITHOUT compromising tomorrow's.",
        "questions": [
            "What is 'development'?",
            "What is 'sustainable development'?",
            "Why is it hard for poor countries to develop without burning fossil fuels?",
            "What are the UN's 'Sustainable Development Goals'?",
            "Name 3 indicators of development (life expectancy, literacy, income).",
            "Why does development sometimes harm the environment?",
            "What is 'green energy'?",
            "Why might it be cheaper LONG-TERM than fossil fuels?",
            "Should developed countries help developing ones? Why?",
            "Name ONE small thing YOU can do.",
        ],
    },
    {
        "id": "caps-soc-g8-hist-industrial-revolution",
        "grade": "Grade 8",
        "title": "History - The Industrial Revolution",
        "description": "Machines, factories, and a transformed world (1760-1840).",
        "intro": "The Industrial Revolution began in Britain ~1760. Machines replaced hand-tools. Factories replaced workshops. The world changed forever.",
        "questions": [
            "Where did the Industrial Revolution start?",
            "Roughly when did it begin?",
            "Name a key invention. (steam engine, spinning jenny)",
            "What replaced hand-tools?",
            "What replaced cottage industries?",
            "What did rural people do? (moved to cities for factory work)",
            "What were factory conditions like? (often terrible)",
            "Did children work in factories?",
            "What environmental impact did factories have?",
            "How did the Industrial Revolution change SA?",
        ],
    },
    # ------------------------------------------------------------------
    # GRADE 9
    # ------------------------------------------------------------------
    {
        "id": "caps-soc-g9-hist-ww1",
        "grade": "Grade 9",
        "title": "History - World War I (1914-1918)",
        "description": "The war that reshaped the 20th century.",
        "intro": "World War I (1914-1918) killed ~16 million people. Triggered by the assassination of Archduke Franz Ferdinand, fuelled by tangled alliances + nationalism.",
        "questions": [
            "When did WWI start and end?",
            "What event triggered WWI? (Franz Ferdinand assassination)",
            "What were the two main alliances?",
            "Which side was Britain on? (Allied)",
            "Did SA fight? (yes - on the British side)",
            "Roughly how many died? (~16 million)",
            "What were 'trenches'?",
            "What new weapons made it so deadly? (machine guns, gas, tanks)",
            "How did WWI end? (Treaty of Versailles, 1919)",
            "Why did the Treaty plant seeds for WWII?",
        ],
    },
    {
        "id": "caps-soc-g9-hist-ww2",
        "grade": "Grade 9",
        "title": "History - World War II (1939-1945)",
        "description": "The deadliest conflict in human history.",
        "intro": "WWII (1939-1945) killed ~70-85 million people. Defined by Nazi Germany's aggression, the Holocaust, and the atomic bomb on Hiroshima/Nagasaki.",
        "questions": [
            "When did WWII begin and end?",
            "What event triggered it? (Germany invading Poland, 1939)",
            "Who was the German leader? (Adolf Hitler)",
            "What were the 'Axis' powers? (Germany, Italy, Japan)",
            "What were the 'Allied' powers? (UK, USA, USSR, France, others)",
            "What was the Holocaust?",
            "Roughly how many Jews were killed in the Holocaust? (~6 million)",
            "How did WWII end in Europe? (Germany surrendered May 1945)",
            "How did it end in the Pacific? (atomic bombs on Hiroshima + Nagasaki)",
            "What organisation was formed after WWII to prevent future wars? (UN)",
        ],
    },
    {
        "id": "caps-soc-g9-hist-apartheid",
        "grade": "Grade 9",
        "title": "History - Apartheid in SA (1948-1994)",
        "description": "The system that defined SA for 46 years.",
        "intro": "Apartheid = legalised racial segregation. Introduced 1948 by the National Party. Affected every part of life: where you lived, worked, studied, even sat on a bus.",
        "questions": [
            "What does 'apartheid' mean? (apart-ness, in Afrikaans)",
            "When did apartheid become official? (1948)",
            "Which party introduced it? (National Party)",
            "What were the 'Pass Laws'?",
            "What was 'Bantu Education'?",
            "Who was Nelson Mandela?",
            "What was the ANC?",
            "What happened at the Sharpeville Massacre? (1960 - police killed 69 protesters)",
            "When did Mandela become president? (1994)",
            "Why is the date 27 April significant to SA? (first democratic election, 1994)",
        ],
    },
    {
        "id": "caps-soc-g9-hist-democracy",
        "grade": "Grade 9",
        "title": "History - SA's Democracy (1994 onwards)",
        "description": "From apartheid's end to today.",
        "intro": "1994 = SA's first democratic election. Mandela became president. The new Constitution (1996) is one of the most progressive in the world.",
        "questions": [
            "When was SA's first democratic election?",
            "Who became the first democratic president?",
            "When was the new Constitution adopted? (1996)",
            "What is the 'Bill of Rights'?",
            "How many official languages does SA recognise? (11)",
            "Who was Desmond Tutu?",
            "What was the 'Truth and Reconciliation Commission'?",
            "Who was Thabo Mbeki?",
            "What are some challenges SA still faces today? (inequality, unemployment, crime, corruption)",
            "What's ONE achievement of SA's democracy worth celebrating?",
        ],
    },
    {
        "id": "caps-soc-g9-geo-globalisation",
        "grade": "Grade 9",
        "title": "Geography - Globalisation",
        "description": "How the world became one connected system.",
        "intro": "Globalisation = the increasing interconnection of economies, cultures, technologies. Made possible by transport + the internet. Both good (access, opportunity) and bad (inequality, exploitation).",
        "questions": [
            "What is 'globalisation'?",
            "Name 3 things that make globalisation possible. (transport, internet, trade agreements)",
            "Name a positive of globalisation.",
            "Name a negative.",
            "Why can you buy goods from China at SA shops?",
            "How has the internet changed SA businesses?",
            "What's a 'multinational company'?",
            "How does globalisation affect culture?",
            "Is globalisation reversible?",
            "What does 'thinking globally, acting locally' mean?",
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
        "source_attribution": "CU3E CAPS Social Sciences pack",
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
    print(f"Seeding {len(WORKSHEETS)} CAPS Social Sciences worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        upload_pdf(env, storage_path, build_pdf(ws))
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} Social Sciences packs in the Study Hub library.")


if __name__ == "__main__":
    main()
