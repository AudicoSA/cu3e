"""
CAPS Afrikaans First Additional Language pack — Grades 1-9, one-shot seeder.

First Additional Language = for kids whose home language is NOT Afrikaans.
So the content stays accessible: G1-3 is oral-focused (greetings, family,
numbers, colours), G4-6 introduces simple grammar (tenses, plurals), G7-9
moves into reading comprehension and short writing.

This pack pairs with the Charles Onselen voice (IT5cb4lfodSX8eyXUzyO) for
voice-mode Afrikaans practice.

~30 packs across G1-9. Same plumbing pattern as the other CAPS seeders.

Run:
    python3 scripts/seed_caps_afrikaans_fal.py
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

SUBJECT = "Afrikaans First Additional Language"

WORKSHEETS = [
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 1 (oral, very basic)
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g1-greetings",
        "grade": "Grade 1",
        "title": "Groete - Greetings",
        "description": "Hallo, totsiens, dankie - the first words to learn.",
        "intro": "Hallo = Hello. Totsiens = Goodbye. Dankie = Thank you. Asseblief = Please.",
        "questions": [
            "How do you say 'Hello' in Afrikaans?",
            "How do you say 'Goodbye' in Afrikaans?",
            "How do you say 'Thank you' in Afrikaans?",
            "How do you say 'Please' in Afrikaans?",
            "What does 'Goeie more' mean? (Hint: morning)",
            "What does 'Goeie nag' mean? (Hint: night)",
            "How would you greet a friend in the morning, in Afrikaans?",
            "How do you ask 'How are you?' in Afrikaans? (Hint: 'Hoe gaan dit?')",
            "Answer 'Hoe gaan dit?' with 'Goed, dankie' - what does that mean?",
            "Practise out loud: Hallo, hoe gaan dit?",
        ],
    },
    {
        "id": "caps-afr-g1-family",
        "grade": "Grade 1",
        "title": "Familie - Family",
        "description": "Words for the people closest to you.",
        "intro": "Ma = Mom. Pa = Dad. Ouma = Grandma. Oupa = Grandpa. Broer = Brother. Suster = Sister.",
        "questions": [
            "What is 'Ma' in English?",
            "What is 'Pa' in English?",
            "What is 'Ouma' in English?",
            "What is 'Oupa' in English?",
            "What is 'Broer' in English?",
            "What is 'Suster' in English?",
            "How do you say 'baby' in Afrikaans? (Hint: 'baba')",
            "How do you say 'family' in Afrikaans?",
            "Translate: 'My ma is mooi.' (Hint: mooi = pretty)",
            "Say this: 'Ek het 'n suster.' What does it mean?",
        ],
    },
    {
        "id": "caps-afr-g1-numbers",
        "grade": "Grade 1",
        "title": "Tel tot Tien - Counting to Ten",
        "description": "Numbers 1-10 in Afrikaans.",
        "intro": "Een (1), twee (2), drie (3), vier (4), vyf (5), ses (6), sewe (7), agt (8), nege (9), tien (10).",
        "questions": [
            "Translate: 'twee'",
            "Translate: 'vyf'",
            "Translate: 'agt'",
            "Translate: 'tien'",
            "How do you say '3' in Afrikaans?",
            "How do you say '6' in Afrikaans?",
            "How do you say '9' in Afrikaans?",
            "Count from one to five in Afrikaans.",
            "What comes after 'sewe'?",
            "What comes before 'vier'?",
        ],
    },
    {
        "id": "caps-afr-g1-body",
        "grade": "Grade 1",
        "title": "Liggaam - Body Parts",
        "description": "Naming parts of your body.",
        "intro": "Kop = head. Oog = eye. Mond = mouth. Neus = nose. Hand = hand. Voet = foot.",
        "questions": [
            "Translate: 'kop'",
            "Translate: 'oog'",
            "Translate: 'mond'",
            "Translate: 'neus'",
            "Translate: 'hand'",
            "Translate: 'voet'",
            "How many 'oe' (eyes - plural is 'oe') do you have?",
            "What body part do you use to listen? (Hint: 'oor')",
            "What body part do you use to eat? (Hint: 'mond')",
            "Touch your kop. What did you touch?",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 2
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g2-colours",
        "grade": "Grade 2",
        "title": "Kleure - Colours",
        "description": "The basic colour words.",
        "intro": "Rooi = red. Blou = blue. Geel = yellow. Groen = green. Swart = black. Wit = white.",
        "questions": [
            "Translate: 'rooi'",
            "Translate: 'blou'",
            "Translate: 'geel'",
            "Translate: 'groen'",
            "Translate: 'swart'",
            "Translate: 'wit'",
            "What colour is the sky? (in Afrikaans)",
            "What colour is grass? (in Afrikaans)",
            "What colour is the sun? (in Afrikaans)",
            "Name your favourite colour in Afrikaans.",
        ],
    },
    {
        "id": "caps-afr-g2-days",
        "grade": "Grade 2",
        "title": "Dae van die Week - Days of the Week",
        "description": "The 7 days, Monday through Sunday.",
        "intro": "Maandag, Dinsdag, Woensdag, Donderdag, Vrydag, Saterdag, Sondag.",
        "questions": [
            "Translate: 'Maandag'",
            "Translate: 'Vrydag'",
            "Translate: 'Sondag'",
            "What comes after 'Dinsdag'?",
            "What comes before 'Donderdag'?",
            "Which days are weekend days in Afrikaans?",
            "Which days are school days in Afrikaans?",
            "What day is today, in Afrikaans?",
            "Count the days of the week in Afrikaans.",
            "What's your favourite dag (day)? Say it in Afrikaans.",
        ],
    },
    {
        "id": "caps-afr-g2-animals",
        "grade": "Grade 2",
        "title": "Diere - Animals",
        "description": "Common animals you'd see in SA.",
        "intro": "Hond = dog. Kat = cat. Koei = cow. Perd = horse. Voel = bird. Vis = fish.",
        "questions": [
            "Translate: 'hond'",
            "Translate: 'kat'",
            "Translate: 'koei'",
            "Translate: 'perd'",
            "Translate: 'voel'",
            "Translate: 'vis'",
            "What sound does a 'hond' make?",
            "Where does a 'vis' live? (in Afrikaans: in die ___)",
            "What's a 'leeu'? (Hint: it roars)",
            "What's an 'olifant'? (Hint: very big, long nose)",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 3
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g3-food",
        "grade": "Grade 3",
        "title": "Kos en Drank - Food and Drink",
        "description": "Words for what you eat and drink.",
        "intro": "Kos = food. Brood = bread. Melk = milk. Water = water. Vrugte = fruit. Vleis = meat.",
        "questions": [
            "Translate: 'kos'",
            "Translate: 'brood'",
            "Translate: 'melk'",
            "Translate: 'water'",
            "Translate: 'vrugte'",
            "What is 'appel' in English?",
            "What is 'piesang' in English? (Hint: yellow fruit)",
            "What is 'sjokolade' in English?",
            "How do you say 'I am hungry' in Afrikaans? (Hint: 'Ek is honger')",
            "How do you say 'I am thirsty'? (Hint: 'Ek is dors')",
        ],
    },
    {
        "id": "caps-afr-g3-school",
        "grade": "Grade 3",
        "title": "Skool - School Words",
        "description": "Vocab for the classroom.",
        "intro": "Skool = school. Juffrou = teacher (female). Meneer = teacher (male). Boek = book. Pen = pen. Klas = class.",
        "questions": [
            "Translate: 'skool'",
            "Translate: 'juffrou'",
            "Translate: 'boek'",
            "Translate: 'pen'",
            "Translate: 'klas'",
            "How do you say 'pencil' in Afrikaans? (Hint: 'potlood')",
            "How do you say 'desk' in Afrikaans? (Hint: 'lessenaar')",
            "What does 'leer' mean? (Hint: to learn)",
            "What does 'lees' mean? (Hint: to read)",
            "Say: 'Ek gaan skool toe.' What does it mean?",
        ],
    },
    {
        "id": "caps-afr-g3-simple-sentences",
        "grade": "Grade 3",
        "title": "Eenvoudige Sinne - Simple Sentences",
        "description": "Putting words together to make a sentence.",
        "intro": "Ek = I. Dit = It. Is = is/am. So: 'Ek is...' = 'I am...'",
        "questions": [
            "Translate: 'Ek is gelukkig.' (gelukkig = happy)",
            "Translate: 'Dit is 'n hond.' (Hint: 'It is a ___')",
            "Translate: 'Ek het 'n boek.' (het = have)",
            "Fill in: 'Ek ___ Tatum.' (am)",
            "Fill in: '___ is 'n kat.' (It)",
            "How do you say 'I am 8 years old'? (Hint: 'Ek is 8 jaar oud')",
            "How do you say 'My name is Tom'? (Hint: 'My naam is Tom')",
            "Make a sentence: I + have + a + dog.",
            "Make a sentence: I + am + happy.",
            "Read aloud: 'Ek hou van my familie.' (hou van = like/love)",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g4-plurals",
        "grade": "Grade 4",
        "title": "Meervoude - Plurals",
        "description": "Most plurals add -e or -s.",
        "intro": "boek -> boeke. seun -> seuns. dogter -> dogters. Some are irregular: kind -> kinders.",
        "questions": [
            "Plural of 'boek' (book): ___",
            "Plural of 'seun' (boy): ___",
            "Plural of 'dogter' (girl): ___",
            "Plural of 'hond' (dog): ___ (Hint: -e)",
            "Plural of 'kat' (cat): ___ (Hint: -te)",
            "Plural of 'kind' (child): ___ (irregular)",
            "Plural of 'man': ___",
            "Plural of 'vrou' (woman): ___",
            "Plural of 'huis' (house): ___",
            "Plural of 'appel' (apple): ___",
        ],
    },
    {
        "id": "caps-afr-g4-common-verbs",
        "grade": "Grade 4",
        "title": "Werkwoorde - Common Verbs",
        "description": "Verbs are 'doing' words. Learn the most-used ones.",
        "intro": "is = is/am. het = have/has. kan = can. wil = want. loop = walk. eet = eat.",
        "questions": [
            "What does 'is' mean?",
            "What does 'het' mean?",
            "What does 'kan' mean?",
            "What does 'wil' mean?",
            "What does 'loop' mean?",
            "What does 'eet' mean?",
            "What does 'speel' mean? (Hint: at the park)",
            "What does 'slaap' mean? (Hint: in your bed)",
            "Translate: 'Ek kan loop.'",
            "Translate: 'Sy eet 'n appel.' (Sy = she)",
        ],
    },
    {
        "id": "caps-afr-g4-adjectives",
        "grade": "Grade 4",
        "title": "Byvoeglike Naamwoorde - Adjectives",
        "description": "Words that describe.",
        "intro": "groot = big. klein = small. mooi = pretty. lelik = ugly. lang = long. kort = short.",
        "questions": [
            "Translate: 'groot'",
            "Translate: 'klein'",
            "Translate: 'mooi'",
            "Translate: 'lelik'",
            "Translate: 'lang'",
            "Translate: 'kort'",
            "What's the opposite of 'groot'?",
            "What's the opposite of 'lang'?",
            "Translate: 'Die hond is groot.'",
            "Make your own sentence using 'klein' (small).",
        ],
    },
    {
        "id": "caps-afr-g4-comprehension",
        "grade": "Grade 4",
        "title": "Begripslees - Simple Comprehension",
        "description": "Read a short passage, answer questions.",
        "intro": (
            "Lees die storie.\n\n"
            "My naam is Sipho. Ek is nege jaar oud. Ek woon in Durban met "
            "my ma, my pa, en my klein suster. My suster se naam is Naledi. "
            "Sy is vyf jaar oud. Ons hou van die strand."
        ),
        "questions": [
            "What is the boy's name?",
            "How old is he? (in numbers)",
            "Where does he live?",
            "What is his sister's name?",
            "How old is she?",
            "What does 'klein suster' mean?",
            "What does 'ons hou van' mean? (Hint: we like)",
            "Where does the family like going?",
            "What does 'ma' mean?",
            "Write one sentence ABOUT yourself in Afrikaans (name + age).",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 5
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g5-past-tense",
        "grade": "Grade 5",
        "title": "Verlede Tyd - Past Tense",
        "description": "How to talk about what already happened.",
        "intro": "Past tense in Afrikaans usually adds 'het' + 'ge-' prefix on the verb. 'Ek loop' (I walk) -> 'Ek het geloop' (I walked).",
        "questions": [
            "What word do you add for past tense?",
            "What prefix is added to most past-tense verbs?",
            "Past of 'speel' (play): Ek het ___.",
            "Past of 'eet' (eat): Ek het ___.",
            "Past of 'loop' (walk): Ek het ___.",
            "Past of 'lees' (read): Ek het ___.",
            "Translate: 'Ek het 'n boek gelees.'",
            "Translate: 'Sy het by die huis gespeel.'",
            "Some verbs are irregular - 'is' -> 'was'. Translate: 'Hy was honger.'",
            "Make a past-tense sentence in Afrikaans about yesterday.",
        ],
    },
    {
        "id": "caps-afr-g5-present-tense",
        "grade": "Grade 5",
        "title": "Teenwoordige Tyd - Present Tense",
        "description": "Talking about RIGHT NOW.",
        "intro": "Present tense in Afrikaans is the simplest tense - no -s for 'he/she'. 'Ek loop, hy loop, ons loop' - same verb form!",
        "questions": [
            "How does Afrikaans differ from English in present tense?",
            "Translate: 'Ek loop.'",
            "Translate: 'Hy loop.'",
            "Translate: 'Ons loop.'",
            "Translate: 'Sy eet kos.'",
            "Translate: 'Hulle speel.'",
            "Translate: 'Die hond blaf.' (blaf = bark)",
            "Make a present-tense sentence about your morning.",
            "Conjugate 'eet' for I, you, he, she, we, they - it's the same! Write it once.",
            "Why is Afrikaans easier than English here?",
        ],
    },
    {
        "id": "caps-afr-g5-articles",
        "grade": "Grade 5",
        "title": "Lidwoorde - Articles",
        "description": "'die' = the. \"'n\" = a/an.",
        "intro": "die hond = the dog. 'n hond = a dog. Notice the apostrophe before n.",
        "questions": [
            "Translate: 'die hond'",
            "Translate: \"'n hond\"",
            "Fill in: '___ kat sit op die mat.' (the)",
            "Fill in: 'Ek het ___ boek.' (a)",
            "When do you use 'die'?",
            "When do you use \"'n\"?",
            "Translate: 'Die juffrou is hier.'",
            "Translate: \"'n Seun loop in die park.\"",
            "Tip: capitalize 'n only when it starts a sentence: \"'n hond\" vs \"'n hond is hier.\" - which is right at the start?",
            "Use both 'die' and \"'n\" in one Afrikaans sentence.",
        ],
    },
    {
        "id": "caps-afr-g5-question-words",
        "grade": "Grade 5",
        "title": "Vraagwoorde - Question Words",
        "description": "How to ask questions in Afrikaans.",
        "intro": "Wat = what. Wie = who. Waar = where. Wanneer = when. Hoekom = why. Hoe = how.",
        "questions": [
            "Translate: 'wat'",
            "Translate: 'wie'",
            "Translate: 'waar'",
            "Translate: 'wanneer'",
            "Translate: 'hoekom'",
            "Translate: 'hoe'",
            "Translate the question: 'Wat is jou naam?'",
            "Translate the question: 'Waar woon jy?'",
            "Translate the question: 'Hoe oud is jy?'",
            "Make a question with 'hoekom' (why) in Afrikaans.",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 6
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g6-negation",
        "grade": "Grade 6",
        "title": "Ontkenning - Negation (nie...nie)",
        "description": "Afrikaans uses a double negative.",
        "intro": "To say 'not' in Afrikaans you usually use 'nie' TWICE: 'Ek loop nie' (one nie). 'Ek loop nie skool toe nie' (two nie). Tricky but consistent!",
        "questions": [
            "What word means 'not' in Afrikaans?",
            "Why is Afrikaans negation tricky for English speakers?",
            "Make negative: 'Ek is honger' -> 'Ek is ___ honger ___.'",
            "Make negative: 'Sy speel buite.' -> 'Sy speel ___ buite ___.'",
            "Translate: 'Ek wil nie eet nie.'",
            "Translate: 'Hy is nie hier nie.'",
            "Translate to Afrikaans: 'I am not happy.'",
            "Translate to Afrikaans: 'She does not like apples.'",
            "When you have a short sentence like 'Ek loop nie' - do you need a second nie? (No!)",
            "Find the negation in: 'Ons hou nie van reen nie.' (What is being negated?)",
        ],
    },
    {
        "id": "caps-afr-g6-time",
        "grade": "Grade 6",
        "title": "Tyd - Telling Time",
        "description": "Hours, days, weeks, asking the time.",
        "intro": "Uur = hour. Dag = day. Week = week. Maand = month. Jaar = year. 'Hoe laat is dit?' = What time is it?",
        "questions": [
            "Translate: 'uur'",
            "Translate: 'dag'",
            "Translate: 'week'",
            "Translate: 'maand'",
            "Translate: 'jaar'",
            "What does 'Hoe laat is dit?' mean?",
            "Translate: 'Dit is 3 uur.'",
            "Translate: 'Dit is vroeg.' (vroeg = early)",
            "Translate: 'Dit is laat.' (laat = late)",
            "Ask 'What time is it?' in Afrikaans.",
        ],
    },
    {
        "id": "caps-afr-g6-weather",
        "grade": "Grade 6",
        "title": "Weer - Weather",
        "description": "Hot, cold, sunny, raining.",
        "intro": "Warm = warm. Koud = cold. Reen = rain. Son = sun. Wolk = cloud. Wind = wind.",
        "questions": [
            "Translate: 'warm'",
            "Translate: 'koud'",
            "Translate: 'reen'",
            "Translate: 'son'",
            "Translate: 'wolk'",
            "Translate: 'wind'",
            "Translate: 'Dit reen.' (It is raining)",
            "Translate: 'Die son skyn.' (skyn = shines)",
            "How would you say 'It is hot today' in Afrikaans? (Hint: 'Dit is warm vandag.')",
            "What's the weather like today? Say it in Afrikaans.",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g7-adjective-placement",
        "grade": "Grade 7",
        "title": "Plek van Byvoeglike Naamwoorde - Adjective Placement",
        "description": "Adjectives go BEFORE the noun in Afrikaans (like English).",
        "intro": "die groot huis = the big house. 'n mooi blom = a pretty flower. Some adjectives need '-e' at the end.",
        "questions": [
            "Translate: 'die groot huis'",
            "Translate: \"'n mooi blom\"",
            "Translate: 'die klein kat'",
            "Translate: 'die lang man'",
            "Translate: 'die rooi appel'",
            "What's the pattern: adjective + noun, or noun + adjective?",
            "Translate to Afrikaans: 'the small dog'",
            "Translate to Afrikaans: 'a long road' (road = pad)",
            "Translate: 'die ou boek' (ou = old)",
            "Make a 3-word phrase in Afrikaans (article + adjective + noun).",
        ],
    },
    {
        "id": "caps-afr-g7-connectives",
        "grade": "Grade 7",
        "title": "Verbindingswoorde - Connecting Words",
        "description": "en, maar, want, omdat - how to link ideas.",
        "intro": "en = and. maar = but. want = because (cause comes after). omdat = because (cause comes after, verb at end).",
        "questions": [
            "Translate: 'en'",
            "Translate: 'maar'",
            "Translate: 'want'",
            "Translate: 'omdat'",
            "Translate: 'Ek is honger en dors.'",
            "Translate: 'Ek wil speel, maar ek moet huiswerk doen.'",
            "Translate: 'Ek is moeg want ek het hard gewerk.'",
            "What's the difference between 'want' and 'omdat'? (Hint: word order)",
            "Combine: 'Ek hou van honde. Ek hou van katte.' (with 'en')",
            "Combine: 'Sy is moeg. Sy het hardgespeel.' (with 'want')",
        ],
    },
    {
        "id": "caps-afr-g7-direct-indirect",
        "grade": "Grade 7",
        "title": "Direkte en Indirekte Rede - Direct/Indirect Speech",
        "description": "Reporting what someone said.",
        "intro": "Direct: Sy se: 'Ek is honger.' Indirect: Sy se dat sy honger is. (Note: verb moves to end.)",
        "questions": [
            "What's the Afrikaans word for 'said'? (Hint: 'het gese')",
            "Direct or indirect: 'Tom se: \"Ek speel.\"'",
            "Direct or indirect: 'Tom se dat hy speel.'",
            "Change to indirect: 'Sy se: \"Ek is moeg.\"'",
            "Change to indirect: 'Hy se: \"Ek hou van skool.\"'",
            "In indirect speech, where does the main verb usually go?",
            "What does 'dat' mean? (It joins the clauses)",
            "Change to direct: 'Sy se dat sy honger is.'",
            "Why are quotation marks important in direct speech?",
            "Write a direct speech sentence in Afrikaans.",
        ],
    },
    {
        "id": "caps-afr-g7-comprehension",
        "grade": "Grade 7",
        "title": "Begripslees - Reading Comprehension",
        "description": "A short passage to read and understand.",
        "intro": (
            "Lees die storie en beantwoord die vrae.\n\n"
            "Tatum loop elke dag skool toe. Sy is sewe jaar oud. Sy hou van "
            "lees en sy is goed met getalle. Op Saterdae speel sy met haar "
            "vriende in die park. Haar gunsteling kos is pasta. Tatum droom "
            "om eendag 'n dokter te word."
        ),
        "questions": [
            "Who is the story about?",
            "How old is Tatum?",
            "How does she get to school each day?",
            "What does she like to do? (Two things)",
            "What does she do on Saturdays?",
            "What is her favourite food?",
            "What does she want to become one day?",
            "Find the Afrikaans word for 'friends' in the passage.",
            "What does 'gunsteling' mean?",
            "What does 'droom' mean?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 8
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g8-verb-conjugation",
        "grade": "Grade 8",
        "title": "Werkwoordvervoeging - Verb Conjugation",
        "description": "Same verb across all subjects (the easy bit of Afrikaans).",
        "intro": "Unlike English (I am, he IS), Afrikaans uses the SAME verb form for all subjects: ek is, hy is, ons is. Just learn the verb once.",
        "questions": [
            "Conjugate 'is' (to be) for: ek, jy, hy, sy, ons, hulle. (Hint: it's the same word!)",
            "Conjugate 'het' (to have) for: ek, jy, hy, sy, ons, hulle.",
            "Conjugate 'kan' (can) - same for all.",
            "What's the Afrikaans for: 'I have'?",
            "What's the Afrikaans for: 'They have'?",
            "What's the Afrikaans for: 'She is happy'?",
            "What's the Afrikaans for: 'We are friends'?",
            "What's the Afrikaans for: 'He can swim'? (swim = swem)",
            "Why is Afrikaans verb conjugation easier than English?",
            "Find ONE exception you've heard of in Afrikaans verbs.",
        ],
    },
    {
        "id": "caps-afr-g8-tense-changes",
        "grade": "Grade 8",
        "title": "Tyd Veranderinge - Changing Tenses",
        "description": "Past, present, future in one sentence.",
        "intro": "Present: Ek eet. Past: Ek het geeet. Future: Ek sal eet (sal = will).",
        "questions": [
            "Present of 'eat': Ek ___ kos.",
            "Past of 'eat': Ek ___ gegeet.",
            "Future of 'eat': Ek ___ eet.",
            "What does 'sal' mean?",
            "Translate: 'Ek sal skool toe gaan.'",
            "Translate: 'Sy het 'n boek gelees.'",
            "Translate: 'Hulle speel buite.'",
            "Change to past: 'Hy loop skool toe.'",
            "Change to future: 'Ek leer Afrikaans.'",
            "What 3 tenses are there in Afrikaans?",
        ],
    },
    {
        "id": "caps-afr-g8-idioms",
        "grade": "Grade 8",
        "title": "Spreekwoorde - Basic Idioms",
        "description": "Phrases that don't translate word-for-word.",
        "intro": "'Nag-nag' = goodnight. 'Lekker' = nice/cool (one of the most used Afrikaans words!). 'Jislaaik' = wow!",
        "questions": [
            "What does 'lekker' mean?",
            "What does 'jislaaik' or 'jis' mean?",
            "What does 'eish' mean?",
            "What does 'braai' mean? (Hint: SA tradition)",
            "What does 'just now' really mean in SA English? (taken from Afrikaans 'nou-nou')",
            "What does 'Bly lekker' mean? (Hint: stay)",
            "Use 'lekker' in a sentence.",
            "What does 'baie dankie' mean?",
            "What does 'baie' mean? (very/many)",
            "Why do English-speaking SA people often slip Afrikaans words into English?",
        ],
    },
    {
        "id": "caps-afr-g8-essay-structure",
        "grade": "Grade 8",
        "title": "Skryf 'n Paragraaf - Writing a Paragraph",
        "description": "Build a short paragraph about yourself.",
        "intro": "Aim: 5-7 short sentences in Afrikaans. Stick to vocabulary you know - don't try to translate complex English sentences.",
        "questions": [
            "What's the simplest way to start: 'My naam is ___.'",
            "Add your age: 'Ek is ___ jaar oud.'",
            "Add where you live: 'Ek woon in ___.'",
            "Add family: 'Ek het 'n ___.' (use 'broer' or 'suster')",
            "Add a like: 'Ek hou van ___.' (favourite thing)",
            "Add a colour: 'My gunsteling kleur is ___.'",
            "Add a food: 'My gunsteling kos is ___.'",
            "Add a friend: 'My beste vriend is ___.'",
            "End with a sentence about today: 'Vandag is ___.' (day of week)",
            "Read your full paragraph out loud.",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 9
    # ------------------------------------------------------------------
    {
        "id": "caps-afr-g9-complex-comprehension",
        "grade": "Grade 9",
        "title": "Komplekse Begripslees - Complex Comprehension",
        "description": "Longer passage with multiple ideas.",
        "intro": (
            "Lees noukeurig.\n\n"
            "Suid-Afrika is 'n land met elf amptelike tale. Afrikaans is "
            "een van hulle. Dit het uit Nederlands ontwikkel oor honderde "
            "jare. Vandag praat ongeveer ses miljoen mense Afrikaans as "
            "hul huistaal. Die taal word veral in die Wes-Kaap en "
            "Noord-Kaap gepraat. Baie Afrikaanse woorde kom voor in "
            "Suid-Afrikaanse Engels - soos 'braai', 'lekker' en 'eish'."
        ),
        "questions": [
            "How many official languages does South Africa have?",
            "What language did Afrikaans develop from?",
            "Roughly how many people speak Afrikaans as their home language?",
            "Which two provinces are mentioned?",
            "Name 3 Afrikaans words that have entered SA English.",
            "What does 'amptelike' mean? (official)",
            "What does 'ontwikkel' mean? (developed)",
            "What does 'huistaal' mean? (home language)",
            "Why has Afrikaans influenced SA English?",
            "Write one sentence about why learning Afrikaans is useful.",
        ],
    },
    {
        "id": "caps-afr-g9-essay-writing",
        "grade": "Grade 9",
        "title": "Opstel - Essay Writing",
        "description": "A short structured piece of writing in Afrikaans.",
        "intro": "Aim: 8-10 sentences on one topic. Inleiding (intro) + 2-3 paragraphs + slot (conclusion).",
        "questions": [
            "Topic: 'My vakansie' (My holiday). Write one intro sentence.",
            "Where did you go? (Real or imagined.) Translate: 'Ek het na ___ gegaan.'",
            "Who went with you? 'Ek het saam met ___ gegaan.'",
            "What did you do? 'Ons het ___ gedoen.'",
            "What did you eat? 'Ons het ___ geeet.'",
            "How did you feel? 'Ek was baie ___.' (baie = very)",
            "What was the BEST part? Write one sentence in Afrikaans.",
            "Write a closing sentence: 'Dit was 'n ___ vakansie.'",
            "Read the full essay aloud - does each sentence make sense?",
            "Underline one new word you used.",
        ],
    },
    {
        "id": "caps-afr-g9-cultural",
        "grade": "Grade 9",
        "title": "Kultuur en Tradisie - Culture and Tradition",
        "description": "Afrikaans culture is part of SA's tapestry.",
        "intro": "Boeremusiek (folk music), braai (barbecue), koeksisters and melktert (traditional foods), rugby - all part of Afrikaans culture.",
        "questions": [
            "What is a 'braai'?",
            "What is a 'koeksister'?",
            "What is a 'melktert'?",
            "What is 'biltong'?",
            "What is 'boeremusiek'?",
            "Translate: 'Ons gaan braai vanaand.'",
            "Translate: 'Ek hou van rugby.'",
            "Name one SA cultural tradition you know.",
            "Why is it useful to learn Afrikaans in South Africa?",
            "Write a sentence about your favourite SA tradition (in Afrikaans).",
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
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
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
    payload = {
        "region": "CAPS",
        "grade": ws["grade"],
        "subject": SUBJECT,
        "title": ws["title"],
        "description": ws["description"],
        "storage_path": storage_path,
        "source_attribution": "CU3E CAPS Afrikaans FAL pack",
        "page_count": 1,
        "is_published": True,
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
    wiped = wipe_existing_rows(env)
    print(f"  removed {wiped} stale rows")
    print(f"Seeding {len(WORKSHEETS)} CAPS Afrikaans FAL worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} Afrikaans FAL packs in the Study Hub library.")


if __name__ == "__main__":
    main()
