"""
CAPS isiZulu First Additional Language pack — Grades 1-9, one-shot seeder.

First Additional Language = for kids whose home language is NOT isiZulu.
G1-3 oral-focused (greetings, family, numbers, body parts), G4-6 simple
grammar (noun classes intro, verb basics), G7-9 reading + writing.

CONTENT QUALITY FLAG: this pack is a v1 baseline written from general
knowledge. isiZulu has noun classes and tonal/click features that benefit
from native-speaker review. The TODO calls out Kenny's friend (a native
isiZulu speaker) as the right person to review + record voice clones for
the audio side.

~30 packs. Same plumbing as the other CAPS seeders.

Run:
    python3 scripts/seed_caps_isizulu_fal.py
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

SUBJECT = "isiZulu First Additional Language"

WORKSHEETS = [
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 1
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g1-greetings",
        "grade": "Grade 1",
        "title": "Ukubingelela - Greetings",
        "description": "The first Zulu words every SA kid should know.",
        "intro": "Sawubona = Hello (to one person). Sanibonani = Hello (to many). Sala kahle = Stay well (goodbye). Ngiyabonga = Thank you.",
        "questions": [
            "How do you say 'Hello' to ONE person in isiZulu?",
            "How do you say 'Hello' to MANY people in isiZulu?",
            "What does 'Sala kahle' mean?",
            "What does 'Ngiyabonga' mean?",
            "Reply to 'Sawubona' with 'Yebo, sawubona.' What does 'yebo' mean?",
            "What does 'Hamba kahle' mean? (Hint: go well, said TO someone leaving)",
            "What does 'Unjani?' mean? (Hint: how are you?)",
            "Reply to 'Unjani?' with 'Ngiyaphila.' What does that mean? (I am well)",
            "What does 'Ngiyaxolisa' mean? (Hint: I'm sorry)",
            "Practise out loud: Sawubona, unjani?",
        ],
    },
    {
        "id": "caps-zul-g1-family",
        "grade": "Grade 1",
        "title": "Umndeni - Family",
        "description": "Words for the people in your home.",
        "intro": "Umama = mother. Ubaba = father. Ugogo = grandmother. Umkhulu = grandfather. Udadewethu = my sister. Umfowethu = my brother.",
        "questions": [
            "What is 'umama' in English?",
            "What is 'ubaba' in English?",
            "What is 'ugogo' in English?",
            "What is 'umkhulu' in English?",
            "What is 'udadewethu' in English?",
            "What is 'umfowethu' in English?",
            "What is 'ingane' in English? (Hint: small one)",
            "How would you call your mother in isiZulu?",
            "How would you call your father in isiZulu?",
            "What does 'umndeni' mean? (family)",
        ],
    },
    {
        "id": "caps-zul-g1-numbers",
        "grade": "Grade 1",
        "title": "Bala kuya Eshumini - Counting to Ten",
        "description": "Numbers 1-10 in isiZulu.",
        "intro": "Kunye (1), kubili (2), kuthathu (3), kune (4), kuhlanu (5), isithupha (6), isikhombisa (7), isishiyagalombili (8), isishiyagalolunye (9), ishumi (10).",
        "questions": [
            "Translate: 'kunye'",
            "Translate: 'kubili'",
            "Translate: 'kuthathu'",
            "Translate: 'kuhlanu'",
            "Translate: 'ishumi'",
            "How do you say '2' in isiZulu?",
            "How do you say '5' in isiZulu?",
            "How do you say '10' in isiZulu?",
            "Count from one to three in isiZulu.",
            "What comes after 'kune' (4)?",
        ],
    },
    {
        "id": "caps-zul-g1-body",
        "grade": "Grade 1",
        "title": "Umzimba - Body Parts",
        "description": "Naming parts of your body.",
        "intro": "Ikhanda = head. Iso = eye. Umlomo = mouth. Ikhala = nose. Isandla = hand. Unyawo = foot.",
        "questions": [
            "Translate: 'ikhanda'",
            "Translate: 'iso'",
            "Translate: 'umlomo'",
            "Translate: 'ikhala'",
            "Translate: 'isandla'",
            "Translate: 'unyawo'",
            "What body part is 'indlebe'? (Hint: hearing)",
            "What body part do you use to eat? (Hint: 'umlomo')",
            "Touch your ikhanda. What did you touch?",
            "Touch your isandla. What did you touch?",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 2
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g2-colours",
        "grade": "Grade 2",
        "title": "Imibala - Colours",
        "description": "Basic colours in isiZulu.",
        "intro": "Bomvu = red. Luhlaza okwesibhakabhaka = blue. Phuzi = yellow. Luhlaza okotshani = green. Mnyama = black. Mhlophe = white.",
        "questions": [
            "Translate: 'bomvu'",
            "Translate: 'phuzi'",
            "Translate: 'mnyama'",
            "Translate: 'mhlophe'",
            "What colour is grass in isiZulu? (luhlaza okotshani)",
            "What colour is the sky in isiZulu? (luhlaza okwesibhakabhaka)",
            "What colour is the sun?",
            "What colour is the night?",
            "Notice 'luhlaza' is in BOTH blue and green. What's the difference?",
            "Name your favourite colour in isiZulu.",
        ],
    },
    {
        "id": "caps-zul-g2-days",
        "grade": "Grade 2",
        "title": "Izinsuku zeViki - Days of the Week",
        "description": "Monday through Sunday in isiZulu.",
        "intro": "uMsombuluko (Mon), uLwesibili (Tue), uLwesithathu (Wed), uLwesine (Thu), uLwesihlanu (Fri), uMgqibelo (Sat), iSonto (Sun).",
        "questions": [
            "Translate: 'uMsombuluko'",
            "Translate: 'uLwesihlanu'",
            "Translate: 'iSonto'",
            "Which day is 'uMgqibelo' in English?",
            "What is 'Tuesday' in isiZulu?",
            "Which days are the weekend in isiZulu?",
            "What's the pattern: uLwesibili = 2nd day, uLwesithathu = 3rd? What number does 'uLwesine' use?",
            "What day is today, in isiZulu?",
            "Count the days: 1 to 7 in isiZulu (use the day names).",
            "What's your favourite day? Say it in isiZulu.",
        ],
    },
    {
        "id": "caps-zul-g2-animals",
        "grade": "Grade 2",
        "title": "Izilwane - Animals",
        "description": "Animals you might see in SA.",
        "intro": "Inja = dog. Ikati = cat. Inkomo = cow. Ihhashi = horse. Inyoni = bird. Inhlanzi = fish.",
        "questions": [
            "Translate: 'inja'",
            "Translate: 'ikati'",
            "Translate: 'inkomo'",
            "Translate: 'ihhashi'",
            "Translate: 'inyoni'",
            "Translate: 'inhlanzi'",
            "What is 'ibhubesi'? (Hint: roars - lion)",
            "What is 'indlovu'? (Hint: very big, long trunk)",
            "What sound does 'inja' make?",
            "Where does 'inhlanzi' live?",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 3
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g3-food",
        "grade": "Grade 3",
        "title": "Ukudla - Food",
        "description": "Words for food and drink.",
        "intro": "Ukudla = food. Isinkwa = bread. Ubisi = milk. Amanzi = water. Inyama = meat. Iqanda = egg.",
        "questions": [
            "Translate: 'ukudla'",
            "Translate: 'isinkwa'",
            "Translate: 'ubisi'",
            "Translate: 'amanzi'",
            "Translate: 'inyama'",
            "Translate: 'iqanda'",
            "What is 'i-apula' in English? (Hint: red fruit)",
            "How do you say 'I am hungry' in isiZulu? (Hint: 'Ngilambile')",
            "How do you say 'I am thirsty'? (Hint: 'Ngomile')",
            "What's a traditional Zulu food you've heard of? (e.g. uphuthu = pap)",
        ],
    },
    {
        "id": "caps-zul-g3-school",
        "grade": "Grade 3",
        "title": "Isikole - School Words",
        "description": "Classroom vocabulary.",
        "intro": "Isikole = school. Uthisha = teacher. Incwadi = book. Ipeni = pen. Ikilasi = class. Umfundi = pupil.",
        "questions": [
            "Translate: 'isikole'",
            "Translate: 'uthisha'",
            "Translate: 'incwadi'",
            "Translate: 'ipeni'",
            "Translate: 'ikilasi'",
            "Translate: 'umfundi'",
            "What does 'funda' mean? (Hint: a doing word - to learn/read)",
            "What does 'bhala' mean? (Hint: with a pen)",
            "Say 'I go to school' in isiZulu: 'Ngiya esikoleni.'",
            "Notice 'esikoleni' = to/at school. The ending changes!",
        ],
    },
    {
        "id": "caps-zul-g3-simple-sentences",
        "grade": "Grade 3",
        "title": "Imisho Elula - Simple Sentences",
        "description": "Putting it together.",
        "intro": "Ngi- = I. Igama lami = my name. So: 'Igama lami ngu...' = 'My name is...'",
        "questions": [
            "Translate: 'Igama lami nguTatum.' (Hint: 'lami' = my)",
            "Fill in: '___ lami nguEla.' (igama)",
            "Translate: 'Ngiyajabula.' (-jabula = happy)",
            "Translate: 'Ngifuna amanzi.' (-funa = want)",
            "How do you say 'I am Tom' in isiZulu? (Hint: 'NginguTom')",
            "How do you say 'I want food'? (Hint: 'Ngifuna ukudla')",
            "What does 'Ngi-' at the start of verbs mean?",
            "Make a simple isiZulu sentence about yourself (name + age).",
            "Translate: 'NginguSipho. Ngineminyaka eyisikhombisa.' (Sipho, 7 years old)",
            "Read aloud: 'Ngithanda umama wami.' (I love my mother)",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g4-noun-classes",
        "grade": "Grade 4",
        "title": "Izigaba Zamabizo - Noun Classes (Intro)",
        "description": "isiZulu groups nouns into CLASSES. Each has a prefix.",
        "intro": "isiZulu has ~15 noun classes! Each class has a prefix that changes meaning. Class 1/2 (umu-/aba-) = people. Class 9/10 (in-/izin-) = animals + many things.",
        "questions": [
            "What's the prefix for 'people' singular? (umu- or um-)",
            "What's the prefix for 'people' plural? (aba- or abe-)",
            "umfana = boy. Plural? (abafana)",
            "umfazi = woman. Plural? (abafazi)",
            "Animals usually start with 'i-' (singular). Inja (dog). Plural? (izinja)",
            "Inkomo (cow). Plural? (izinkomo)",
            "Why does isiZulu need noun classes?",
            "What's the singular of 'abantwana' (children)? (umntwana)",
            "Try: umfundi (pupil) -> plural? (abafundi)",
            "Just like English plurals (cat/cats), but isiZulu changes the FRONT not the back.",
        ],
    },
    {
        "id": "caps-zul-g4-common-verbs",
        "grade": "Grade 4",
        "title": "Izenzo - Common Verbs",
        "description": "Verbs are 'doing' words.",
        "intro": "-funa = want. -hamba = go/walk. -dla = eat. -phuza = drink. -lala = sleep. -dlala = play.",
        "questions": [
            "What does '-funa' mean?",
            "What does '-hamba' mean?",
            "What does '-dla' mean?",
            "What does '-phuza' mean?",
            "What does '-lala' mean?",
            "What does '-dlala' mean?",
            "Add 'Ngi-' (I) to '-funa': 'Ngifuna' = ?",
            "Translate: 'Ngiyahamba.' (the -ya- is for present continuous)",
            "Translate: 'Ngidla isinkwa.'",
            "Make: 'I want water' in isiZulu (Ngi + funa + amanzi).",
        ],
    },
    {
        "id": "caps-zul-g4-adjectives",
        "grade": "Grade 4",
        "title": "Izichasiso - Adjectives",
        "description": "Describing words. They MATCH the noun class.",
        "intro": "-khulu = big. -ncane = small. -de = tall. -hle = nice. Adjectives change prefix based on noun. (Tricky!)",
        "questions": [
            "What does '-khulu' mean?",
            "What does '-ncane' mean?",
            "What does '-de' mean?",
            "What does '-hle' mean?",
            "inja enkulu = big dog. What's 'small dog'? (inja encane)",
            "umfana omkhulu = big boy. What's 'small boy'? (umfana omncane)",
            "Why do adjectives in isiZulu start with different prefixes for different nouns?",
            "What's the opposite of '-khulu'?",
            "What's the opposite of '-de'? (-fushane = short)",
            "Translate: 'inja enkulu' (Hint: 'a big ___')",
        ],
    },
    {
        "id": "caps-zul-g4-comprehension",
        "grade": "Grade 4",
        "title": "Ukufunda - Simple Reading",
        "description": "A short passage to practise reading.",
        "intro": (
            "Funda le ndaba.\n\n"
            "Igama lami nguThandi. Ngineminyaka eyisithupha. Ngihlala "
            "eThekwini nomama wami, ubaba wami, kanye nodadewethu. "
            "Udadewethu wami ngu-Anele. Uneminyaka emine. Sithanda "
            "ukudlala olwandle."
        ),
        "questions": [
            "What is the girl's name?",
            "How old is she? (in numbers)",
            "Where does she live? ('eThekwini' = in Durban)",
            "Who does she live with? (Name them)",
            "What's her sister's name?",
            "How old is her sister?",
            "Where do they like to play? ('olwandle' = at the beach/sea)",
            "What does 'umama' mean?",
            "What does 'udadewethu' mean?",
            "Write one sentence about yourself in isiZulu (try Igama lami...).",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 5
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g5-past-tense",
        "grade": "Grade 5",
        "title": "Inkathi Edlule - Past Tense",
        "description": "How to say what already happened.",
        "intro": "Past tense in isiZulu often ends -ile. -hamba (go) -> hambile (went). -dla (eat) -> dlile (ate).",
        "questions": [
            "Past of '-hamba' (go): ___",
            "Past of '-dla' (eat): ___",
            "Past of '-phuza' (drink): ___",
            "Past of '-funda' (read/learn): ___",
            "Past of '-dlala' (play): ___",
            "Translate: 'Ngihambile.' (I went / I have gone)",
            "Translate: 'Sidlile.' (we ate / we have eaten)",
            "What's the common past-tense ending?",
            "Make: 'I played' in isiZulu (Ngi + dlal + ile).",
            "Make: 'I ate' in isiZulu (Ngi + dl + ile -> ngidlile).",
        ],
    },
    {
        "id": "caps-zul-g5-present-tense",
        "grade": "Grade 5",
        "title": "Inkathi Yamanje - Present Tense",
        "description": "What's happening RIGHT NOW.",
        "intro": "Present continuous often uses '-ya-' in the middle: Ngiyahamba = I am going. Without '-ya-': Ngihamba = I go.",
        "questions": [
            "Translate: 'Ngiyahamba.'",
            "Translate: 'Ngiyadla.'",
            "Translate: 'Uhamba.' (he/she goes)",
            "Translate: 'Bayahamba.' (they go)",
            "Translate: 'Siyadlala.' (we play)",
            "What's the difference between Ngihamba and Ngiyahamba?",
            "Translate: 'Sidla ukudla.'",
            "Translate: 'Uphuza amanzi.'",
            "Conjugate 'go' for: I, you, he/she, we, they (Ngi-, U-, U-, Si-, Ba-).",
            "Make: 'They are eating' in isiZulu (Ba + ya + dla).",
        ],
    },
    {
        "id": "caps-zul-g5-question-words",
        "grade": "Grade 5",
        "title": "Imibuzo - Question Words",
        "description": "How to ask questions in isiZulu.",
        "intro": "Yini? = What? Ubani? = Who? Kuphi? = Where? Nini? = When? Kungani? = Why? Kanjani? = How?",
        "questions": [
            "Translate: 'Yini?'",
            "Translate: 'Ubani?'",
            "Translate: 'Kuphi?'",
            "Translate: 'Nini?'",
            "Translate: 'Kungani?'",
            "Translate: 'Kanjani?'",
            "Translate the question: 'Igama lakho ngubani?' (What is your name?)",
            "Translate the question: 'Uhlala kuphi?' (Where do you live?)",
            "Translate the question: 'Uneminyaka emingaki?' (How old are you?)",
            "Ask 'What time is it?' in isiZulu (Sikhathi sini?).",
        ],
    },
    {
        "id": "caps-zul-g5-articles-pronouns",
        "grade": "Grade 5",
        "title": "Subject Pronouns",
        "description": "Ngi, U, U, Si, Ni, Ba - the verb prefixes for I, you, he/she, we, you-plural, they.",
        "intro": "isiZulu doesn't use separate 'I', 'you', etc. The verb prefix tells you. Ngi- = I. U- = you (one). U- = he/she. Si- = we. Ni- = you (many). Ba- = they.",
        "questions": [
            "What prefix means 'I'?",
            "What prefix means 'you' (one person)?",
            "What prefix means 'he/she'?",
            "What prefix means 'we'?",
            "What prefix means 'you' (many people)?",
            "What prefix means 'they'?",
            "'Ngi + hamba' = ?",
            "'Si + dla' = ?",
            "'Ba + funda' = ?",
            "'U + lala' = ? (depending on context: you sleep / he or she sleeps)",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 6
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g6-negation",
        "grade": "Grade 6",
        "title": "Ukuphika - Negation",
        "description": "How to say 'not' in isiZulu.",
        "intro": "Add 'a-' at the front, change last vowel to '-i'. Ngiyahamba (I go) -> Angihambi (I don't go).",
        "questions": [
            "What letter is added at the start for negation?",
            "What letter does the verb usually END with in the negative?",
            "Negative of 'Ngiyadla' (I eat): ___ (Angidli)",
            "Negative of 'Uyahamba' (he goes): ___ (Akahambi)",
            "Translate: 'Angifuni' (I don't want)",
            "Translate: 'Asihambi' (we don't go)",
            "Translate: 'I don't eat' (Angidli)",
            "Translate: 'They don't play' (Abadlali)",
            "Why does the last vowel change in negative?",
            "Pattern: add a- at start, change -a to -i at end. Try with -lala (sleep): 'I don't sleep' = ?",
        ],
    },
    {
        "id": "caps-zul-g6-time",
        "grade": "Grade 6",
        "title": "Isikhathi - Time",
        "description": "Hours, days, asking for time.",
        "intro": "Ihora = hour. Usuku = day. Iviki = week. Inyanga = month. Unyaka = year.",
        "questions": [
            "Translate: 'ihora'",
            "Translate: 'usuku'",
            "Translate: 'iviki'",
            "Translate: 'inyanga'",
            "Translate: 'unyaka'",
            "How do you ask 'what time is it'? (Sikhathi sini?)",
            "Translate: 'Sikhathi sasekuseni.' (Morning time)",
            "Translate: 'Kusebusuku.' (It is night)",
            "What does 'namuhla' mean? (today)",
            "What does 'izolo' mean? (yesterday)",
        ],
    },
    {
        "id": "caps-zul-g6-weather",
        "grade": "Grade 6",
        "title": "Isimo Sezulu - Weather",
        "description": "Hot, cold, raining, sunny.",
        "intro": "Kushisa = it is hot. Kuyabanda = it is cold. Liyana = it is raining. Lishonile = it is sunny/clear. Umoya = wind.",
        "questions": [
            "Translate: 'Kushisa.'",
            "Translate: 'Kuyabanda.'",
            "Translate: 'Liyana.'",
            "Translate: 'umoya'",
            "How would you say 'It is hot today' (Kushisa namuhla)?",
            "How would you say 'It is raining'?",
            "What does 'amafu' mean? (clouds)",
            "What does 'ilanga' mean? (sun)",
            "What's the weather right now? Say it in isiZulu.",
            "What's your favourite weather, and how would you describe it?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g7-connecting",
        "grade": "Grade 7",
        "title": "Amagama Okuxhumanisa - Connecting Words",
        "description": "Joining ideas in a sentence.",
        "intro": "futhi = and (also). kodwa = but. ngoba = because. lapho = where/when.",
        "questions": [
            "Translate: 'futhi'",
            "Translate: 'kodwa'",
            "Translate: 'ngoba'",
            "Translate: 'lapho'",
            "Translate: 'Ngihambile, kodwa angidlanga.' (I went, but I didn't eat)",
            "Translate: 'Ngiyajabula ngoba ngiphumelele.' (I am happy because I succeeded)",
            "Combine 'Ngifuna amanzi' + 'Ngomile' with 'ngoba'.",
            "What's the difference between 'kanye' (and-together-with) and 'futhi' (and-also)?",
            "Translate: 'lapho ngihlala khona' (where I live)",
            "Make a sentence using 'kodwa' in isiZulu.",
        ],
    },
    {
        "id": "caps-zul-g7-direct-indirect",
        "grade": "Grade 7",
        "title": "Inkulumo Eqondile - Direct vs Indirect Speech",
        "description": "Quoting vs reporting.",
        "intro": "Direct: Wathi: 'Ngiyahamba.' Indirect: Wathi uyahamba. (Note: 'ukuthi' = 'that')",
        "questions": [
            "What does 'wathi' mean? (he/she said)",
            "What does 'ukuthi' mean?",
            "Direct: 'Wathi: Ngifuna ukudla.' Translate.",
            "Indirect form: 'Wathi ufuna ukudla.' Translate.",
            "Change to indirect: 'Sipho wathi: Ngiyahamba.'",
            "Change to indirect: 'Thandi wathi: Ngifuna amanzi.'",
            "Why are quotation marks used in direct speech?",
            "What word joins the two clauses in indirect speech?",
            "Change to direct: 'Wathi udlile.'",
            "Write a direct speech sentence in isiZulu.",
        ],
    },
    {
        "id": "caps-zul-g7-reading-comprehension",
        "grade": "Grade 7",
        "title": "Ukufundwa - Reading Comprehension",
        "description": "A short passage to read and understand.",
        "intro": (
            "Funda futhi uphendule.\n\n"
            "uMandla ungumfundi eGrade 7. Uneminyaka eyishumi nambili. "
            "Uthanda kakhulu ibhola lezinyawo (soccer). Uthandwa ngabazali "
            "bakhe ngoba uyathandeka futhi ucabanga ngamanye abantu. "
            "Ngolwesihlanu, udlala umqhudelwano nethimba lakhe lasesikoleni."
        ),
        "questions": [
            "What is the boy's name?",
            "What grade is he in?",
            "How old is he? (12)",
            "What sport does he love? (soccer / football)",
            "Why is he loved by his parents?",
            "When does he have a match? (Friday)",
            "Who does he play with? (his school team)",
            "What does 'ibhola lezinyawo' mean?",
            "What does 'ithimba' mean? (team)",
            "Write one sentence in isiZulu about YOUR favourite sport.",
        ],
    },
    {
        "id": "caps-zul-g7-cultural",
        "grade": "Grade 7",
        "title": "Amasiko - Zulu Culture",
        "description": "Traditions, history, important figures.",
        "intro": "Zulu culture is rich - kings (uShaka), traditional dance, beadwork, ceremonies. Hlonipha = respect (a core value).",
        "questions": [
            "What does 'hlonipha' mean?",
            "Who was uShaka? (famous Zulu king)",
            "What is 'ukudla' in Zulu food culture? (food / meal)",
            "What is 'umqombothi'? (traditional sorghum beer)",
            "What is 'isidwaba'? (traditional Zulu skirt)",
            "What is 'umakoti'? (a bride)",
            "What does 'umuntu' mean? (a person - root of 'ubuntu')",
            "What does 'ubuntu' mean? (humanity, 'I am because we are')",
            "Name one Zulu province in SA. (KwaZulu-Natal)",
            "Why is learning isiZulu important in SA?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 8
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g8-verb-conjugation",
        "grade": "Grade 8",
        "title": "Ukuxoxisana Kwezenzo - Verb Conjugation",
        "description": "Same verb across all subjects + tenses.",
        "intro": "isiZulu verbs build like LEGO. Prefix (who) + tense marker + root + ending. Ngi + ya + hamb + a = I am going.",
        "questions": [
            "Break down 'Ngiyahamba': Ngi + ___ + ___ + ___?",
            "Break down 'Sidlala': Si + ___ + ___?",
            "Break down 'Bayadlala': Ba + ya + dlal + a. What does it mean? (They are playing)",
            "Build: 'They are eating' (Ba + ya + dl + a)",
            "Build: 'We are reading' (Si + ya + fund + a)",
            "Past adds -ile at the end: 'I went' = Ngihambile. Build 'they went' (Ba + hamb + ile).",
            "Why is isiZulu called 'agglutinative'?",
            "What does the prefix 'U-' mean? (he/she OR you-singular)",
            "Translate: 'Bayafunda esikoleni.' (they read/learn at school)",
            "Translate to isiZulu: 'We are sleeping.' (Si + ya + lal + a)",
        ],
    },
    {
        "id": "caps-zul-g8-tense-changes",
        "grade": "Grade 8",
        "title": "Ukushintsha Izikhathi - Tense Changes",
        "description": "Past, present, future.",
        "intro": "Past = ends -ile. Present = -ya- in middle (continuous). Future = -zo- in middle. Ngizohamba = I will go.",
        "questions": [
            "Past of 'hamba' (go): ___",
            "Future of 'hamba' (go): ___ (Ngizohamba)",
            "What does '-ile' mean at the end?",
            "What does '-zo-' mean in the middle?",
            "Translate: 'Ngizodla.' (I will eat)",
            "Translate: 'Bazohamba.' (They will go)",
            "Translate: 'Sidlile.' (we have eaten)",
            "Change to future: 'Ngiyafunda.' (Ngizofunda)",
            "Change to past: 'Bayadlala.' (Badlalile)",
            "Build: 'They will read' in isiZulu (Ba + zo + funda).",
        ],
    },
    {
        "id": "caps-zul-g8-paragraph-writing",
        "grade": "Grade 8",
        "title": "Bhala Iparagrafu - Writing a Paragraph",
        "description": "5-7 sentences about yourself.",
        "intro": "Use vocab you know. Don't try to translate complex English - use simple isiZulu sentences.",
        "questions": [
            "Start: 'Igama lami ngu___.' (My name is ___)",
            "Add age: 'Ngineminyaka e___.' (I am ___ years old - use a Zulu number)",
            "Add where: 'Ngihlala e___.' (I live in ___)",
            "Add family: 'Nginomama nobaba.' (I have a mom and dad) — adjust as true.",
            "Add a sibling: 'Nginodadewethu / Nginomfowethu.' (sister/brother)",
            "Add a like: 'Ngithanda ___.' (I love ___)",
            "Add school: 'Ngifunda esikoleni.' (I learn at school)",
            "Add today: 'Namuhla ___.' (today is ___ day)",
            "End with: 'Ngiyajabula.' (I am happy)",
            "Read your full paragraph aloud.",
        ],
    },
    {
        "id": "caps-zul-g8-comprehension-longer",
        "grade": "Grade 8",
        "title": "Ukufunda - Longer Comprehension",
        "description": "A passage with more detail.",
        "intro": (
            "Funda futhi uphendule.\n\n"
            "uSiphesihle ungumfundi eGrade 8. Uthanda ukufunda izincwadi "
            "kakhulu, futhi uhlala efunda ngamanyathelo amasha empilweni. "
            "Ngempelasonto, usiza unina ekhaya kanye nokupheka. Ukhuthele "
            "futhi unothando lokufunda. Ufuna ukuba udokotela uma ekhula."
        ),
        "questions": [
            "What is the learner's name?",
            "What grade is she/he in?",
            "What does she/he like to do? (read books)",
            "Who does she/he help on weekends?",
            "What two things does she/he do at home? (help mom + cook)",
            "What does she/he want to become?",
            "What does 'udokotela' mean? (doctor)",
            "What does 'ukukhula' mean? (to grow up)",
            "What does 'impelasonto' mean? (weekend)",
            "Write one sentence about what YOU want to become.",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 9
    # ------------------------------------------------------------------
    {
        "id": "caps-zul-g9-essay-writing",
        "grade": "Grade 9",
        "title": "Indaba Yokuziphilisa - Personal Essay",
        "description": "Tell a story about yourself in isiZulu.",
        "intro": "Aim: 8-10 sentences. Hold to simple sentence structures. Build on the vocab you've learned.",
        "questions": [
            "Topic: 'Umndeni wami' (My family). Start with: 'Igama lami ngu___.'",
            "Add: 'Ngihlala no___.' (I live with ___)",
            "Add: 'Umama wami ungu___.' (My mom is named ___)",
            "Add: 'Ubaba wami ungu___.' (My dad is named ___)",
            "Add a sibling: 'Nginodadewethu / Nginomfowethu.'",
            "Describe one family member: 'Umama wami uthandeka.' (My mom is loving)",
            "Add an activity: 'Ngolwesihlanu siya esontweni.' (On Fridays we go to church) — adapt as true.",
            "Add a feeling: 'Ngiyabathanda.' (I love them)",
            "Add a wish: 'Ngifuna umndeni wami uthandane.' (I want my family to love each other)",
            "End: 'Lokho kungumndeni wami.' (That is my family)",
        ],
    },
    {
        "id": "caps-zul-g9-cultural-context",
        "grade": "Grade 9",
        "title": "Amasiko Nezenzo - Cultural Context",
        "description": "isiZulu as a window into Zulu culture and ubuntu.",
        "intro": "Language carries culture. Words like 'ubuntu', 'hlonipha', 'umakoti', 'isikhathi' all carry deeper cultural meanings.",
        "questions": [
            "What does 'ubuntu' mean culturally, beyond 'humanity'?",
            "What does 'hlonipha' (respect) require - just words, or also behaviour?",
            "What is 'umakoti' and what role does she play in a family?",
            "What does it mean to 'be African' according to ubuntu?",
            "Why are extended family ties so important in Zulu culture?",
            "What is the role of 'isiZulu' in modern SA?",
            "How many people speak isiZulu (roughly)? (~12 million home speakers)",
            "Is isiZulu growing or shrinking as a language?",
            "Why is it valuable for SA children to learn isiZulu even if it's not their home language?",
            "Write one sentence in isiZulu about ubuntu (use what you know).",
        ],
    },
    {
        "id": "caps-zul-g9-reading-modern",
        "grade": "Grade 9",
        "title": "Ukufunda Okusezingeni - Reading at Senior Level",
        "description": "A more complex passage about modern SA.",
        "intro": (
            "Funda noxolo, bese uphendula.\n\n"
            "iNingizimu Afrika inezilimi eziyishumi nanye ezisemthethweni. "
            "isiZulu siyilona elikhulunywa kakhulu - ngabantu abangaba "
            "yizigidi eziyishumi nambili. Sikhulunywa kakhulu KwaZulu-Natal. "
            "Ulimi luvele eminyakeni eminingi edlule futhi luqhubeka "
            "lukhula nezwe."
        ),
        "questions": [
            "How many official languages does SA have? (11 - eleven)",
            "Which is the most spoken?",
            "Roughly how many home speakers does isiZulu have? (~12 million)",
            "Which province is it most spoken in? (KwaZulu-Natal)",
            "What does 'isemthethweni' mean? (official)",
            "What does 'eziyishumi nanye' mean? (eleven)",
            "What does 'isigidi' mean? (million)",
            "What does 'ezisemthethweni' tell you about isiZulu's status?",
            "Why might isiZulu be growing more important in SA?",
            "Write one sentence about why YOU would like to learn isiZulu.",
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
        "source_attribution": "CU3E CAPS isiZulu FAL pack (v1 - native review pending)",
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
    print(f"Seeding {len(WORKSHEETS)} CAPS isiZulu FAL worksheets...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} isiZulu FAL packs in the Study Hub library.")


if __name__ == "__main__":
    main()
