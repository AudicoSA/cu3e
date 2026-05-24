"""
CAPS Natural Sciences starter pack — Grades 4-9, one-shot seeder.

NatSci is taught from Grade 4 onwards in CAPS (Foundation Phase covers
science under Life Skills, which gets its own pack later). Grades 4-6 it's
"Natural Sciences and Technology" — combined. Grades 7-9 it splits.

Generates ~30 worksheets across the four CAPS strands:
  - Life and Living
  - Matter and Materials
  - Energy and Change
  - Planet Earth and Beyond

5 worksheets per grade × 6 grades = 30.

Same plumbing as seed_caps_english.py / seed_caps_foundation.py. Wipes only
this subject's rows on re-run.

Run from website-app:
    python3 scripts/seed_caps_natural_sciences.py
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

SUBJECT = "Natural Sciences"

# ---------------------------------------------------------------------------
# CAPS Natural Sciences Grades 4-9
# ---------------------------------------------------------------------------

WORKSHEETS = [
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g4-living-nonliving",
        "grade": "Grade 4",
        "title": "Living and Non-Living Things",
        "description": "What makes something 'alive' — the seven life processes.",
        "intro": "Living things MOVE, breathe, grow, feed, sense, reproduce, and get rid of waste. Non-living things don't do all seven.",
        "questions": [
            "Name three living things in your house.",
            "Name three non-living things in your house.",
            "Living or non-living: a tree?",
            "Living or non-living: a rock?",
            "Living or non-living: a fire? (Tricky — discuss!)",
            "List the 7 life processes.",
            "Does a car move? Is it alive? Why not?",
            "Does a plant grow? Is it alive?",
            "What does 'reproduce' mean?",
            "Name one thing only living things do that non-living things never do.",
        ],
    },
    {
        "id": "caps-natsci-g4-plants",
        "grade": "Grade 4",
        "title": "Plants and How They Grow",
        "description": "The parts of a plant and what each one does.",
        "intro": "Plants have roots, a stem, leaves, flowers, and seeds. Each part has a job.",
        "questions": [
            "What do roots do? (Two jobs)",
            "What does the stem do?",
            "What is the main job of leaves?",
            "Why do flowers attract bees?",
            "What grows from a seed?",
            "What does a plant need to grow? (List 4 things)",
            "Where does a plant get water from?",
            "Where does a plant get sunlight from?",
            "Name a plant we eat the ROOT of.",
            "Name a plant we eat the LEAVES of.",
        ],
    },
    {
        "id": "caps-natsci-g4-states-of-matter",
        "grade": "Grade 4",
        "title": "States of Matter — Solid, Liquid, Gas",
        "description": "Everything around us is one of three forms.",
        "intro": "Solid = fixed shape. Liquid = takes the shape of its container. Gas = spreads out everywhere.",
        "questions": [
            "Give two examples of solids.",
            "Give two examples of liquids.",
            "Give two examples of gases.",
            "Solid, liquid or gas: ice?",
            "Solid, liquid or gas: water?",
            "Solid, liquid or gas: steam?",
            "What's it called when a solid turns into a liquid?",
            "What's it called when a liquid turns into a gas?",
            "If you heat ice, what does it become?",
            "If you cool water vapour, what does it become?",
        ],
    },
    {
        "id": "caps-natsci-g4-energy-from-sun",
        "grade": "Grade 4",
        "title": "Energy from the Sun",
        "description": "The sun is the source of almost all energy on Earth.",
        "intro": "Plants use sunlight. Animals eat plants. We eat both. All of it traces back to the sun.",
        "questions": [
            "Why is the sun important?",
            "Name one type of energy we get from the sun.",
            "How do plants use sunlight?",
            "What kind of panel turns sunlight into electricity?",
            "Why is it warmer in summer than winter?",
            "Without the sun, what would happen to plants?",
            "Without plants, what would happen to animals?",
            "Name one non-living thing that the sun affects (like the weather).",
            "What is a 'food chain'? Give a tiny example.",
            "Is the sun a star? Yes or no.",
        ],
    },
    {
        "id": "caps-natsci-g4-water-cycle",
        "grade": "Grade 4",
        "title": "The Water Cycle",
        "description": "Water never disappears — it just changes form and moves.",
        "intro": "Evaporation -> Condensation -> Precipitation -> Collection. Repeat forever.",
        "questions": [
            "What is evaporation?",
            "What is condensation?",
            "What is precipitation? Name 3 types.",
            "Where does evaporation happen most? (oceans/lakes)",
            "What energy drives the water cycle?",
            "Why do clouds form?",
            "Why does rain fall back to Earth?",
            "Where does rainwater go after it lands?",
            "Has Earth gained or lost water over millions of years? (Hint: it's a CYCLE)",
            "Why is the water cycle important to plants and animals?",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 5
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g5-habitats",
        "grade": "Grade 5",
        "title": "Plant and Animal Habitats",
        "description": "Different living things need different homes.",
        "intro": "A habitat is the natural home of a plant or animal. The desert, ocean, savanna, and rainforest are all habitats.",
        "questions": [
            "What is a habitat?",
            "Name an animal that lives in the desert.",
            "Name an animal that lives in the ocean.",
            "Name an animal that lives in the rainforest.",
            "How is a polar bear suited to its habitat? (Give 2 features)",
            "How is a camel suited to the desert? (Give 2 features)",
            "What's the main habitat in South Africa's Kruger Park?",
            "Why would a fish die out of water?",
            "What is 'adaptation'?",
            "Pick an animal you like. Describe its habitat in one sentence.",
        ],
    },
    {
        "id": "caps-natsci-g5-mixtures",
        "grade": "Grade 5",
        "title": "Mixtures and How to Separate Them",
        "description": "Mixing two things doesn't always create something new.",
        "intro": "A mixture = two or more substances mixed together but NOT joined chemically. You can separate them back out.",
        "questions": [
            "Is salt water a mixture?",
            "Is air a mixture? Of what?",
            "How would you separate sand from water?",
            "How would you separate iron filings from sand?",
            "How would you separate salt from salt water?",
            "What method uses a magnet?",
            "What method uses filter paper?",
            "What method uses evaporation?",
            "Mix oil and water. What happens?",
            "Is fruit salad a mixture? Yes or no.",
        ],
    },
    {
        "id": "caps-natsci-g5-forces",
        "grade": "Grade 5",
        "title": "Forces — Push, Pull, Friction",
        "description": "Every movement is caused by a force.",
        "intro": "Push and pull are forces. Friction is the force that slows things down when they rub.",
        "questions": [
            "What is a force?",
            "Is opening a door a push or a pull? (Both possible!)",
            "Is kicking a ball a push or a pull?",
            "What slows a rolling ball on grass?",
            "Name a place where friction is HELPFUL.",
            "Name a place where friction is a PROBLEM.",
            "Why do shoes have grip?",
            "Why do tyres have tread?",
            "What happens if you reduce friction with oil?",
            "Pull-vs-push: when you climb a ladder, which is the force you use?",
        ],
    },
    {
        "id": "caps-natsci-g5-solar-system",
        "grade": "Grade 5",
        "title": "The Solar System",
        "description": "Our 8 planets, the sun, and our place in space.",
        "intro": "8 planets orbit the sun. From closest to furthest: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
        "questions": [
            "Name the 8 planets in order from the sun.",
            "Which planet is closest to the sun?",
            "Which planet is furthest from the sun?",
            "Which is the biggest planet?",
            "Is Earth a star or a planet?",
            "Why is Mars called the 'red planet'?",
            "What's between Mars and Jupiter? (Hint: rocky belt)",
            "How long does Earth take to go around the sun?",
            "What is a 'moon'?",
            "Why is Pluto NOT a planet anymore?",
        ],
    },
    {
        "id": "caps-natsci-g5-magnetism",
        "grade": "Grade 5",
        "title": "Magnetism",
        "description": "Magnets attract some metals — but not all.",
        "intro": "Magnets attract iron, nickel, cobalt. They do NOT attract gold, copper, plastic, wood.",
        "questions": [
            "What metals do magnets attract?",
            "Name a material magnets do NOT attract.",
            "What are the two ends of a magnet called?",
            "What happens when you put two NORTH poles together?",
            "What happens when you put NORTH and SOUTH together?",
            "Is Earth a giant magnet? (Yes or no)",
            "What instrument uses a magnet to find north?",
            "Name something at home that uses a magnet.",
            "Are coins magnetic? Test it!",
            "Can a magnet work through paper? Yes or no.",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 6
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g6-photosynthesis",
        "grade": "Grade 6",
        "title": "Photosynthesis",
        "description": "How plants make their own food.",
        "intro": "Photosynthesis: water + carbon dioxide + sunlight -> glucose (food) + oxygen. Happens in the leaves.",
        "questions": [
            "What is photosynthesis?",
            "What 3 things does a plant NEED for photosynthesis?",
            "What 2 things does photosynthesis PRODUCE?",
            "Where in the plant does it happen?",
            "What green substance traps sunlight? (starts with 'c')",
            "Where does the plant get water from?",
            "Where does the plant get carbon dioxide from?",
            "What does the plant give off into the air?",
            "Why is photosynthesis important for humans?",
            "Can photosynthesis happen at night? Why or why not?",
        ],
    },
    {
        "id": "caps-natsci-g6-particles-in-matter",
        "grade": "Grade 6",
        "title": "Particles in Matter",
        "description": "Everything is made of tiny particles in constant motion.",
        "intro": "Solid = particles packed tightly. Liquid = particles slide past each other. Gas = particles fly apart.",
        "questions": [
            "Are particles in a solid packed tightly or far apart?",
            "Are particles in a gas packed tightly or far apart?",
            "In which state do particles move FASTEST?",
            "In which state do particles barely move?",
            "What happens to particles when heat is added?",
            "What happens to particles when something cools?",
            "Why does a balloon get bigger if heated?",
            "Why can you compress gas but not solid?",
            "Why does a smell spread across a room? (Hint: particles)",
            "Draw or describe particles in: ice, water, steam.",
        ],
    },
    {
        "id": "caps-natsci-g6-circuits",
        "grade": "Grade 6",
        "title": "Simple Electric Circuits",
        "description": "Cells, wires, switches, and bulbs.",
        "intro": "A circuit is a loop. Current flows from the cell through wires, lights the bulb, and returns. Break the loop -> no light.",
        "questions": [
            "What is a 'circuit'?",
            "What does a cell (battery) do?",
            "What does a bulb do?",
            "What does a switch do?",
            "If a switch is OPEN, does current flow?",
            "If a switch is CLOSED, does current flow?",
            "If you remove the cell, what happens to the bulb?",
            "Name a material that conducts electricity.",
            "Name a material that does NOT (insulator).",
            "In a series circuit with 2 bulbs, what happens if you remove ONE bulb?",
        ],
    },
    {
        "id": "caps-natsci-g6-weather-climate",
        "grade": "Grade 6",
        "title": "Weather and Climate",
        "description": "Weather changes daily. Climate is the average over years.",
        "intro": "Weather = today's conditions. Climate = the long-term pattern for a region.",
        "questions": [
            "Difference between weather and climate?",
            "Name 4 things weather can be (sunny, rainy, etc.).",
            "What's the climate of the Sahara Desert?",
            "What's the climate of Durban — tropical or polar?",
            "What instrument measures temperature?",
            "What instrument measures wind?",
            "What instrument measures rainfall?",
            "What's the difference between fog and a cloud?",
            "Why do thunderstorms happen?",
            "What is 'global warming' in one sentence?",
        ],
    },
    {
        "id": "caps-natsci-g6-sound",
        "grade": "Grade 6",
        "title": "Sound and How It Travels",
        "description": "Sound is a wave — it needs something to travel through.",
        "intro": "Sound is caused by vibrations. It travels as waves through air, water, and solids — but NOT through empty space.",
        "questions": [
            "What causes sound?",
            "What does sound travel through?",
            "Can sound travel through space? Why or why not?",
            "Which is faster: sound through air, water, or steel?",
            "What is the 'pitch' of a sound?",
            "What is the 'volume' of a sound?",
            "Why do you see lightning before you hear thunder?",
            "How does the human ear pick up sound?",
            "Name an animal that hears better than humans.",
            "What is an 'echo'?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g7-cells",
        "grade": "Grade 7",
        "title": "Cells — The Building Blocks of Life",
        "description": "Every living thing is made of cells.",
        "intro": "A cell is the smallest unit of life. Plant cells have walls + chloroplasts. Animal cells don't.",
        "questions": [
            "What is a cell?",
            "What instrument lets us see cells?",
            "Name 3 parts of a typical cell.",
            "What does the nucleus do?",
            "What does the cell membrane do?",
            "Name ONE thing plant cells have that animal cells DON'T.",
            "What does chlorophyll do?",
            "Are bacteria made of cells?",
            "How many cells in a human body (roughly)?",
            "What is a 'tissue'?",
        ],
    },
    {
        "id": "caps-natsci-g7-atoms-elements",
        "grade": "Grade 7",
        "title": "Atoms, Elements, Compounds",
        "description": "Atoms are the smallest unit of matter.",
        "intro": "Element = one type of atom (e.g. oxygen). Compound = two or more elements chemically joined (e.g. water = H2O).",
        "questions": [
            "What is an atom?",
            "What is an element?",
            "What is a compound?",
            "Is water an element or compound?",
            "Is oxygen an element or compound?",
            "What is the chemical symbol for oxygen?",
            "What is the chemical symbol for water?",
            "What is the chemical symbol for carbon dioxide?",
            "How many different elements exist (roughly)?",
            "Name 3 elements you've heard of.",
        ],
    },
    {
        "id": "caps-natsci-g7-energy-transfer",
        "grade": "Grade 7",
        "title": "Energy Transfer and Conservation",
        "description": "Energy is never created or destroyed — only changed.",
        "intro": "Law of Conservation of Energy: energy can transform (chemical -> heat -> light), but the total amount stays the same.",
        "questions": [
            "Name 5 forms of energy.",
            "Energy transformation in a torch: chemical (battery) -> ___ -> light.",
            "Energy transformation in a kettle: electrical -> ___.",
            "Energy transformation when YOU run: ___ -> kinetic + heat.",
            "Can energy be destroyed?",
            "Can energy be created?",
            "What does 'conservation' mean here?",
            "When you drop a ball, what energy does it have at the top?",
            "When the ball is moving, what energy does it have?",
            "Name a renewable energy source.",
        ],
    },
    {
        "id": "caps-natsci-g7-rocks-minerals",
        "grade": "Grade 7",
        "title": "Rocks and Minerals",
        "description": "The three types of rock: igneous, sedimentary, metamorphic.",
        "intro": "Igneous = cooled lava. Sedimentary = layers compacted. Metamorphic = changed by heat/pressure.",
        "questions": [
            "Name the 3 main rock types.",
            "How is igneous rock formed?",
            "How is sedimentary rock formed?",
            "How is metamorphic rock formed?",
            "Granite is what type of rock?",
            "Sandstone is what type of rock?",
            "Marble is what type of rock?",
            "What is a 'mineral'?",
            "Name a mineral South Africa is famous for mining.",
            "What's the 'rock cycle'?",
        ],
    },
    {
        "id": "caps-natsci-g7-food-chains",
        "grade": "Grade 7",
        "title": "Food Chains and Food Webs",
        "description": "Who eats whom — the flow of energy through living things.",
        "intro": "Producer -> Primary consumer -> Secondary consumer -> Tertiary consumer. Arrows show energy flow.",
        "questions": [
            "What is a 'producer'?",
            "What is a 'consumer'?",
            "Why are plants called producers?",
            "What is a 'herbivore'?",
            "What is a 'carnivore'?",
            "What is an 'omnivore'?",
            "Give an example food chain with 3 levels.",
            "What is a 'decomposer'? Give one example.",
            "What's the difference between a food CHAIN and food WEB?",
            "If all the grass died, what would happen to the zebras?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 8
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g8-body-systems",
        "grade": "Grade 8",
        "title": "Body Systems — Digestion, Respiration, Circulation",
        "description": "Three of the body's major systems.",
        "intro": "Each system has organs that work together. Digestion = food. Respiration = air. Circulation = blood.",
        "questions": [
            "Name 3 organs in the digestive system.",
            "Where does digestion BEGIN?",
            "What does the stomach do?",
            "What gas do we breathe IN?",
            "What gas do we breathe OUT?",
            "Where in the body does gas exchange happen?",
            "What organ pumps blood?",
            "What carries oxygen in the blood?",
            "How are the respiratory and circulatory systems linked?",
            "Why do you breathe faster when running?",
        ],
    },
    {
        "id": "caps-natsci-g8-chemical-reactions",
        "grade": "Grade 8",
        "title": "Chemical Reactions",
        "description": "When substances change into new substances.",
        "intro": "Reactants -> Products. Signs of a reaction: colour change, gas, heat, light, precipitate.",
        "questions": [
            "What's a 'chemical reaction'?",
            "What are 'reactants'?",
            "What are 'products'?",
            "Name 3 signs that a reaction has happened.",
            "Is burning wood a chemical reaction? Why?",
            "Is melting ice a chemical reaction? Why or why not?",
            "Combustion: fuel + ___ -> CO2 + water + heat.",
            "Rusting is what kind of reaction?",
            "What's an 'endothermic' reaction?",
            "What's an 'exothermic' reaction?",
        ],
    },
    {
        "id": "caps-natsci-g8-heat-transfer",
        "grade": "Grade 8",
        "title": "Heat Transfer — Conduction, Convection, Radiation",
        "description": "Three ways heat moves.",
        "intro": "Conduction = through solids (touching). Convection = through fluids (rising/falling). Radiation = through empty space (like sunlight).",
        "questions": [
            "Name the 3 types of heat transfer.",
            "Holding a hot mug — which type?",
            "Boiling water in a pot — main type?",
            "Heat from the sun — which type?",
            "Why do hot air balloons rise?",
            "Why are metal pots good for cooking?",
            "Are wood and plastic good conductors or insulators?",
            "Why is a vacuum flask good at keeping coffee hot?",
            "How does radiation reach Earth through space?",
            "Cooling a room with a fan uses which idea?",
        ],
    },
    {
        "id": "caps-natsci-g8-atmosphere",
        "grade": "Grade 8",
        "title": "The Atmosphere and Greenhouse Gases",
        "description": "Earth's blanket — and why too much is a problem.",
        "intro": "The atmosphere is the layer of gas around Earth. Greenhouse gases (CO2, methane) trap heat.",
        "questions": [
            "What 2 gases make up MOST of the atmosphere?",
            "What % of air is oxygen (roughly)?",
            "What is a 'greenhouse gas'?",
            "Name 2 greenhouse gases.",
            "Where does most CO2 in the atmosphere come from today?",
            "What's the 'greenhouse effect'?",
            "Is the greenhouse effect always bad? (Hint: no — too much is)",
            "Name 2 ways humans add CO2 to the air.",
            "Why are forests important for the atmosphere?",
            "What can YOU do to reduce greenhouse gases?",
        ],
    },
    {
        "id": "caps-natsci-g8-light",
        "grade": "Grade 8",
        "title": "Visible Light — Reflection and Refraction",
        "description": "Light bounces and bends.",
        "intro": "Reflection = light bounces off a surface (mirror). Refraction = light bends when it enters a new medium (water).",
        "questions": [
            "What is reflection?",
            "What is refraction?",
            "Why can you see yourself in a mirror?",
            "Why does a straw look 'broken' in a glass of water?",
            "What are the 7 colours of the visible spectrum?",
            "What does ROYGBIV stand for?",
            "Why does a prism split light?",
            "What causes a rainbow?",
            "Light travels in a straight line — true or false?",
            "Does light travel FASTER through air or water?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 9
    # ------------------------------------------------------------------
    {
        "id": "caps-natsci-g9-cell-division-genetics",
        "grade": "Grade 9",
        "title": "Cell Division and Genetics",
        "description": "How traits pass from parent to child.",
        "intro": "Mitosis = body cells split for growth. Meiosis = sex cells split for reproduction. DNA carries the instructions.",
        "questions": [
            "What is mitosis?",
            "What is meiosis?",
            "Which produces sex cells?",
            "Which is for growth and repair?",
            "What does DNA stand for?",
            "Where is DNA stored in a cell?",
            "How many chromosomes do humans have?",
            "What is a 'gene'?",
            "Why do children look like their parents?",
            "Why are siblings (with same parents) not identical?",
        ],
    },
    {
        "id": "caps-natsci-g9-periodic-table",
        "grade": "Grade 9",
        "title": "The Periodic Table",
        "description": "All known elements, arranged by their properties.",
        "intro": "Rows = periods. Columns = groups (similar properties). Atomic number = number of protons.",
        "questions": [
            "What does the atomic number tell you?",
            "What is in a 'group' on the periodic table?",
            "What is in a 'period'?",
            "Group 1 are called what? (alkali metals)",
            "Group 18 are called what? (noble gases)",
            "Is hydrogen a metal or non-metal?",
            "What's special about noble gases?",
            "Name a metal in group 1.",
            "Name a non-metal that's a gas at room temperature.",
            "What's the symbol for sodium?",
        ],
    },
    {
        "id": "caps-natsci-g9-newtons-laws",
        "grade": "Grade 9",
        "title": "Forces and Newton's Laws",
        "description": "The three laws that explain how things move.",
        "intro": "1: Objects keep moving unless a force acts on them. 2: F = m × a. 3: Every action has an equal and opposite reaction.",
        "questions": [
            "State Newton's First Law in your own words.",
            "State Newton's Second Law.",
            "State Newton's Third Law.",
            "What does inertia mean?",
            "If F = m × a, find F when m = 2 kg and a = 3 m/s².",
            "If F = m × a, find a when F = 20 N and m = 5 kg.",
            "When you jump, you push down on the ground — what pushes you up?",
            "Why do passengers jolt forward when a car brakes hard?",
            "What's the unit of force?",
            "Why does a heavier object feel harder to push?",
        ],
    },
    {
        "id": "caps-natsci-g9-geological-history",
        "grade": "Grade 9",
        "title": "Geological History of Earth",
        "description": "Plate tectonics, continental drift, deep time.",
        "intro": "Earth is ~4.6 billion years old. Continents move, mountains rise, species evolve and go extinct.",
        "questions": [
            "How old is Earth (roughly)?",
            "What is 'plate tectonics'?",
            "Were all continents once joined? What was that supercontinent called?",
            "Why do earthquakes happen?",
            "Why do volcanoes happen?",
            "How are mountains formed?",
            "What killed the dinosaurs (most accepted theory)?",
            "What is a 'fossil'?",
            "What can fossils tell us?",
            "Where do most earthquakes happen — along plate boundaries or in the middle?",
        ],
    },
    {
        "id": "caps-natsci-g9-electricity",
        "grade": "Grade 9",
        "title": "Electricity — Voltage, Current, Resistance",
        "description": "Ohm's Law and what each quantity actually is.",
        "intro": "Voltage = the 'push'. Current = the flow rate. Resistance = how much the wire fights the flow. Ohm's Law: V = I × R.",
        "questions": [
            "What does voltage measure?",
            "What does current measure?",
            "What does resistance measure?",
            "State Ohm's Law as a formula.",
            "If V = 12 V and R = 4 Ohm, find I.",
            "If I = 2 A and R = 5 Ohm, find V.",
            "If V = 9 V and I = 3 A, find R.",
            "What's the unit of voltage?",
            "What's the unit of current?",
            "What's the unit of resistance?",
        ],
    },
]


def build_extracted_text(ws: dict) -> str:
    lines = [
        f"{ws['title']} - {ws['grade']}",
        ws["intro"],
        "",
    ]
    for i, q in enumerate(ws["questions"], start=1):
        lines.append(f"Q{i}: {q}")
    return "\n".join(lines)


def build_pdf(ws: dict) -> bytes:
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
        Paragraph(f"{ws['grade']} - CAPS - CU3E", sub),
        Paragraph(ws["intro"].replace("\n", "<br/>"), intro),
    ]
    for i, qtext in enumerate(ws["questions"], start=1):
        story.append(Paragraph(f"<b>Q{i}.</b> &nbsp; {qtext}", q))
        story.append(Spacer(1, 4))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Supabase plumbing (same shape as the other CAPS seeders)
# ---------------------------------------------------------------------------

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
        if e.code == 409 or "Duplicate" in body:
            return
        sys.exit(f"upload failed for {storage_path}: {e.code} {body[:200]}")


def wipe_existing_rows(env: dict) -> int:
    """DELETE only this subject's CAPS rows."""
    base = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/curriculum_library"
    headers = {
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Prefer": "return=representation",
    }
    subject_param = urllib.parse.quote(SUBJECT)
    req = urllib.request.Request(
        f"{base}?region=eq.CAPS&subject=eq.{subject_param}",
        method="DELETE",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            deleted = json.loads(r.read() or b"[]")
            return len(deleted)
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
    extracted = build_extracted_text(ws)
    payload = {
        "region": "CAPS",
        "grade": ws["grade"],
        "subject": SUBJECT,
        "title": ws["title"],
        "description": ws["description"],
        "storage_path": storage_path,
        "source_attribution": "CU3E CAPS Natural Sciences pack",
        "page_count": 1,
        "is_published": True,
        "extracted_text": extracted,
        "question_count": len(ws["questions"]),
    }
    req = urllib.request.Request(
        base,
        data=json.dumps(payload).encode(),
        method="POST",
        headers=headers,
    )
    try:
        urllib.request.urlopen(req, timeout=15).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"insert failed for {ws['id']}: {e.code} {e.read().decode(errors='replace')[:200]}")


def main() -> None:
    env = load_env()
    print(f"Wiping existing CAPS {SUBJECT} rows from library...")
    wiped = wipe_existing_rows(env)
    print(f"  removed {wiped} stale rows")
    print(f"Seeding {len(WORKSHEETS)} CAPS Natural Sciences worksheets (Grades 4-9)...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} Natural Sciences packs in the Study Hub library.")


if __name__ == "__main__":
    main()
