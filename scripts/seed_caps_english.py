"""
CAPS English Home Language starter pack — Grades 1-9, one-shot seeder.

Generates ~45 English worksheets covering CAPS Grade 1 through Grade 9
(phonics + sight words for Foundation Phase, comprehension + grammar
for Intermediate, literary analysis + writing for Senior). Renders each
to a PDF via reportlab, uploads to Supabase Storage under
curriculum/library/, and inserts a curriculum_library row per pack with
extracted_text already populated so activation is instant.

Mirror of seed_caps_foundation.py (which is the Maths pack) — same
plumbing, different content. Per-subject scripts are deliberately
self-contained: each subject is one file you can read end-to-end.

Run from the website-app directory:
    python3 scripts/seed_caps_english.py

Requires:
    pip install reportlab

Env (read from .env.local):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Idempotent: wipes all CAPS English rows at the start, then re-inserts
the current WORKSHEETS list. Maths packs are untouched (we filter on
subject='English Home Language' so the Maths and English seeders never
clobber each other).
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

SUBJECT = "English Home Language"

# ---------------------------------------------------------------------------
# CAPS English Home Language Grades 1-9
# ---------------------------------------------------------------------------

WORKSHEETS = [
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 1 (phonics, sight words, early reading)
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g1-letter-sounds-a-m",
        "grade": "Grade 1",
        "title": "Letter Sounds A to M",
        "description": "First half of the alphabet — say the sound, find the word.",
        "intro": "Say the sound of each letter. Then think of a word that starts with that sound.",
        "questions": [
            "What sound does 'A' make? (Hint: 'a' as in 'apple')",
            "What sound does 'B' make?",
            "Word starting with 'C': c_____ (Hint: meows!)",
            "What sound does 'D' make?",
            "Word starting with 'E': e_____ (Hint: bird in a tree)",
            "What sound does 'F' make?",
            "Word starting with 'G': g_____ (Hint: green grass)",
            "What sound does 'H' make? (Hint: like the wind)",
            "Word starting with 'I': i_____ (Hint: frozen water)",
            "What sound does 'M' make? (Hint: ymmmmm)",
        ],
    },
    {
        "id": "caps-eng-g1-letter-sounds-n-z",
        "grade": "Grade 1",
        "title": "Letter Sounds N to Z",
        "description": "Second half of the alphabet — finishing the sounds.",
        "intro": "Each letter has its own sound. Say it out loud!",
        "questions": [
            "Word starting with 'N': n_____ (Hint: time for bed)",
            "Word starting with 'O': o_____ (Hint: red round fruit)",
            "Word starting with 'P': p_____ (Hint: write with this)",
            "Word starting with 'R': r_____ (Hint: hops, with long ears)",
            "Word starting with 'S': s_____ (Hint: bright in the sky)",
            "Word starting with 'T': t_____ (Hint: it has leaves and a trunk)",
            "Word starting with 'V': v_____ (Hint: car with four wheels)",
            "Word starting with 'W': w_____ (Hint: drink it cold)",
            "Word starting with 'Y': y_____ (Hint: colour of the sun)",
            "Word starting with 'Z': z_____ (Hint: stripey animal)",
        ],
    },
    {
        "id": "caps-eng-g1-cvc-blending",
        "grade": "Grade 1",
        "title": "Blending CVC Words",
        "description": "Consonant + vowel + consonant. The first proper reading!",
        "intro": "Say each sound slowly: c-a-t. Then blend them: cat!",
        "questions": [
            "Blend: c-a-t = ?",
            "Blend: d-o-g = ?",
            "Blend: s-u-n = ?",
            "Blend: b-i-g = ?",
            "Blend: h-o-t = ?",
            "Sound out: 'pen'. What sounds do you hear?",
            "Sound out: 'top'. What sounds do you hear?",
            "Make a CVC word starting with 'm' and ending with 'p'.",
            "Make a CVC word starting with 'r' and ending with 'd'.",
            "Read aloud: 'The cat sat on a mat.' What word repeats?",
        ],
    },
    {
        "id": "caps-eng-g1-sight-words-1",
        "grade": "Grade 1",
        "title": "Sight Words — Set 1",
        "description": "Tiny words you must just KNOW (no sounding out).",
        "intro": "These words pop up everywhere. Learn them on sight!",
        "questions": [
            "Read: 'I'",
            "Read: 'the'",
            "Read: 'and'",
            "Read: 'is'",
            "Read: 'a'",
            "Read: 'to'",
            "Read: 'we'",
            "Read: 'go'",
            "Read: 'me'",
            "Read this sentence: 'I go to the zoo.'",
        ],
    },
    {
        "id": "caps-eng-g1-rhyming-words",
        "grade": "Grade 1",
        "title": "Rhyming Words",
        "description": "Words that SOUND the same at the end.",
        "intro": "Cat and hat rhyme. They end with the same sound!",
        "questions": [
            "Word that rhymes with 'cat': ___",
            "Word that rhymes with 'dog': ___",
            "Word that rhymes with 'sun': ___ (Hint: had a great time)",
            "Word that rhymes with 'bed': ___",
            "Word that rhymes with 'pig': ___",
            "Does 'top' rhyme with 'mop'? Yes / No",
            "Does 'cup' rhyme with 'cat'? Yes / No",
            "Find the rhyme: hat, mat, ___",
            "Find the rhyme: ten, hen, ___",
            "Make up your own rhyming pair!",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 2
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g2-long-vowels",
        "grade": "Grade 2",
        "title": "Long Vowel Sounds",
        "description": "When a vowel says its own name — 'a' as in 'cake'.",
        "intro": "Magic 'e' at the end makes the vowel long: cap → cape.",
        "questions": [
            "Long 'a' word: c_p_ (Hint: birthday treat)",
            "Long 'i' word: k_t_ (Hint: flies on a string)",
            "Long 'o' word: r_p_ (Hint: thick string)",
            "Long 'u' word: c_b_ (Hint: 3D shape with 6 faces)",
            "Long 'e' word: t_____ (Hint: write 't-r-e-e' for what gives shade)",
            "cap or cape — which has the long 'a'?",
            "kit or kite — which has the long 'i'?",
            "hop or hope — which has the long 'o'?",
            "tub or tube — which has the long 'u'?",
            "Add 'e' to 'tap' → ___",
        ],
    },
    {
        "id": "caps-eng-g2-digraphs",
        "grade": "Grade 2",
        "title": "Digraphs — sh, ch, th, wh",
        "description": "Two letters that make ONE new sound.",
        "intro": "'sh' = quiet sound. 'ch' = chocolate. 'th' = think. 'wh' = whisper.",
        "questions": [
            "'sh' word: s_____ (Hint: a fish in the sea, big teeth)",
            "'ch' word: c_____ (Hint: sit on it)",
            "'th' word: t_____ (Hint: number after 2)",
            "'wh' word: w_____ (Hint: question — at what time?)",
            "What sound does 'sh' make? (a hint sound, demo it)",
            "Spell the sound: c-h-i-p = ?",
            "Spell the sound: t-h-i-s = ?",
            "Find the digraph in 'wheel': ___",
            "Find the digraph in 'shop': ___",
            "Underline the digraph: 'The chicken sat on the chair.'",
        ],
    },
    {
        "id": "caps-eng-g2-plurals",
        "grade": "Grade 2",
        "title": "Plurals — One and Many",
        "description": "Add 's' for many. Add 'es' if the word ends in s, sh, ch, x.",
        "intro": "One cat, two cats. One bus, two buses!",
        "questions": [
            "Plural of 'dog': ___",
            "Plural of 'book': ___",
            "Plural of 'bus': ___ (Hint: ends in 's' so add 'es')",
            "Plural of 'box': ___",
            "Plural of 'fox': ___",
            "Plural of 'dish': ___",
            "Plural of 'church': ___",
            "Plural of 'apple': ___",
            "Plural of 'hat': ___",
            "Tricky: plural of 'child' = ___ (not 'childs'!)",
        ],
    },
    {
        "id": "caps-eng-g2-comprehension-story",
        "grade": "Grade 2",
        "title": "Reading Comprehension — Sam the Dog",
        "description": "Read a tiny story and answer questions.",
        "intro": (
            "Read this story, then answer the questions.\n\n"
            "Sam is a brown dog. Sam loves to run in the park. Every day, "
            "Sam's owner Mia takes him to play. They throw a red ball. Sam "
            "catches it and brings it back. Sam wags his tail when he is happy."
        ),
        "questions": [
            "What colour is Sam?",
            "What kind of animal is Sam?",
            "Who is Sam's owner?",
            "Where do they go to play?",
            "What colour is the ball?",
            "What does Sam do with the ball?",
            "How can you tell Sam is happy?",
            "Do you think Sam likes Mia? Why?",
            "What word in the story means 'every single day'?",
            "Make up a new ending for the story.",
        ],
    },
    {
        "id": "caps-eng-g2-capitals-fullstops",
        "grade": "Grade 2",
        "title": "Capital Letters and Full Stops",
        "description": "Where to start big and where to stop.",
        "intro": "Sentences start with a CAPITAL letter and end with a full stop.",
        "questions": [
            "Add the capital: '___ go to school.' (First word)",
            "Add the full stop: 'I love my dog___'",
            "Fix this: 'my name is tom'",
            "Fix this: 'we live in durban'",
            "Fix this: 'mom made supper'",
            "Names also use capitals. Spell properly: 'tatum'.",
            "Place names use capitals. Spell: 'south africa'.",
            "'I' is always a capital. Fix: 'i went to bed'.",
            "How many capitals in 'My friend James lives in Cape Town.'? Count them.",
            "Write a sentence using a capital and a full stop.",
        ],
    },
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 3
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g3-prefixes-suffixes",
        "grade": "Grade 3",
        "title": "Prefixes and Suffixes",
        "description": "Adding letters to the front or back changes the meaning.",
        "intro": "Prefix = front (un-, re-). Suffix = back (-ing, -ed, -er, -ly).",
        "questions": [
            "Add 'un-' to 'happy': ___",
            "Add 'un-' to 'kind': ___",
            "Add 're-' to 'do': ___ (means 'do again')",
            "Add '-ing' to 'jump': ___",
            "Add '-ed' to 'play': ___",
            "Add '-er' to 'teach': ___ (a person who teaches)",
            "Add '-ly' to 'quick': ___",
            "What does 'untie' mean?",
            "What does 'retake' mean?",
            "Build a new word with a prefix and tell me what it means.",
        ],
    },
    {
        "id": "caps-eng-g3-nouns-verbs",
        "grade": "Grade 3",
        "title": "Nouns and Verbs",
        "description": "Nouns name things. Verbs are action words.",
        "intro": "Noun = person, place, thing or animal. Verb = something you DO.",
        "questions": [
            "Is 'dog' a noun or verb?",
            "Is 'run' a noun or verb?",
            "Is 'school' a noun or verb?",
            "Is 'jump' a noun or verb?",
            "Pick the noun: 'Mia eats apples.' (Hint: 2 nouns)",
            "Pick the verb: 'The bird sings.'",
            "Pick the verb: 'I love my mom.'",
            "Name 3 nouns in your bedroom.",
            "Name 3 verbs you can do at the park.",
            "Make a sentence with at least one noun and one verb.",
        ],
    },
    {
        "id": "caps-eng-g3-punctuation",
        "grade": "Grade 3",
        "title": "Question Marks and Exclamations",
        "description": "When to use ? and !",
        "intro": "? = a question. ! = surprise, excitement, or shouting.",
        "questions": [
            "Add the right mark: 'What is your name___'",
            "Add the right mark: 'Wow, that is huge___'",
            "Add the right mark: 'Where do you live___'",
            "Add the right mark: 'I love ice cream___'",
            "Add the right mark: 'Look out___'",
            "Add the right mark: 'How old are you___'",
            "Add the right mark: 'I am 8 years old___'",
            "Add the right mark: 'That was amazing___'",
            "Write a sentence that needs a '?'.",
            "Write a sentence that needs a '!'.",
        ],
    },
    {
        "id": "caps-eng-g3-comprehension-leo",
        "grade": "Grade 3",
        "title": "Comprehension — Leo's Big Day",
        "description": "Read carefully and find the answers in the text.",
        "intro": (
            "Read the story, then answer.\n\n"
            "It was Leo's first day at his new school. He felt nervous. His "
            "mom packed him a sandwich and an apple. At break, a boy named "
            "Pete shared his cricket bat with Leo. They played together. By "
            "the end of the day, Leo had made a new friend. He couldn't wait "
            "to come back tomorrow."
        ),
        "questions": [
            "How did Leo feel at the start of the day?",
            "What did Leo's mom pack for him?",
            "Who shared a cricket bat with Leo?",
            "What game did they play?",
            "How did Leo feel by the end of the day?",
            "Why was Leo nervous? (use your own words)",
            "What does 'couldn't wait' mean?",
            "Find a word in the story that means 'lunch break'.",
            "Do you think Leo and Pete will be friends? Why?",
            "Have YOU ever felt nervous starting something new? Tell me.",
        ],
    },
    {
        "id": "caps-eng-g3-writing-a-story",
        "grade": "Grade 3",
        "title": "Writing a Short Story",
        "description": "Beginning, middle, end. 3-5 sentences.",
        "intro": "Every good story has: who, where, what happens.",
        "questions": [
            "Who is the main character in your story? Just a name.",
            "Where does the story happen? (beach, school, jungle...)",
            "What's the problem? (lost something, scared, hungry, etc.)",
            "Write ONE sentence to start: 'One day, ___.'",
            "Write ONE middle sentence: 'Then, ___.'",
            "Write ONE end sentence: 'Finally, ___.'",
            "What is the main feeling of your story? (happy, scary, silly)",
            "Add a describing word (adjective) to your story.",
            "Read your story aloud — does it make sense?",
            "Give your story a title.",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g4-parts-of-speech",
        "grade": "Grade 4",
        "title": "Parts of Speech — Nouns, Verbs, Adjectives",
        "description": "Adjectives describe nouns. Verbs do the action.",
        "intro": "Noun = thing. Verb = action. Adjective = a word that describes.",
        "questions": [
            "Find the adjective: 'The fluffy cat slept.'",
            "Find the adjective: 'A loud bang scared me.'",
            "Find the noun: 'The teacher smiled at us.'",
            "Find the verb: 'My brother kicks the ball.'",
            "Add an adjective: 'The ___ dog barked.'",
            "Add an adjective: 'I ate a ___ apple.'",
            "List 3 adjectives that describe a beach.",
            "List 3 verbs you do in the morning.",
            "Sentence with all three: noun + verb + adjective. (e.g. 'The big bird flies.')",
            "In 'The shiny red car raced past', name: the noun, verb, and 2 adjectives.",
        ],
    },
    {
        "id": "caps-eng-g4-sentence-types",
        "grade": "Grade 4",
        "title": "Four Types of Sentences",
        "description": "Statement, question, command, exclamation.",
        "intro": "Statement = tells. Question = asks. Command = orders. Exclamation = excited!",
        "questions": [
            "What type: 'Close the door.'",
            "What type: 'Are you ready?'",
            "What type: 'I am hungry.'",
            "What type: 'What a beautiful day!'",
            "Make a question about your favourite food.",
            "Make a statement about the weather today.",
            "Make a command for your dog.",
            "Make an exclamation about a goal in soccer.",
            "Turn into a question: 'You are coming.'",
            "Turn into a command: 'You should be quiet.'",
        ],
    },
    {
        "id": "caps-eng-g4-tenses",
        "grade": "Grade 4",
        "title": "Past, Present, Future Tenses",
        "description": "When did it happen? Then, now, or later.",
        "intro": "Past = already done. Present = happening now. Future = will happen.",
        "questions": [
            "Past tense of 'walk': ___",
            "Past tense of 'eat': ___",
            "Past tense of 'go': ___",
            "Past tense of 'run': ___",
            "Future of 'play': 'I ___ play tomorrow.'",
            "What tense is 'She is reading'? (Past / Present / Future)",
            "What tense is 'He will visit'? (Past / Present / Future)",
            "What tense is 'They ate'? (Past / Present / Future)",
            "Change to past: 'I climb the tree.' → ___",
            "Change to future: 'We watch TV.' → ___",
        ],
    },
    {
        "id": "caps-eng-g4-comprehension-savanna",
        "grade": "Grade 4",
        "title": "Comprehension — The Savanna",
        "description": "Non-fiction passage about African grasslands.",
        "intro": (
            "Read the passage.\n\n"
            "The savanna is a wide grassland with scattered trees. It is "
            "found in many parts of Africa. The savanna has two seasons: a "
            "wet season and a dry season. Lions, zebras, giraffes and "
            "elephants all live here. The acacia tree is famous for its "
            "flat top and long thorns. Animals follow the rain to find "
            "fresh grass and water."
        ),
        "questions": [
            "What is the savanna?",
            "How many seasons does the savanna have?",
            "Name three animals that live in the savanna.",
            "What is special about the acacia tree?",
            "Why do animals follow the rain?",
            "Is this passage fiction or non-fiction?",
            "Find a word that means 'spread out here and there'.",
            "Find a word that means 'a long time without rain'.",
            "Why might it be hard to find water in the dry season?",
            "What would YOU find most interesting about the savanna?",
        ],
    },
    {
        "id": "caps-eng-g4-paragraph-writing",
        "grade": "Grade 4",
        "title": "Writing a Paragraph",
        "description": "Topic sentence, supporting details, closing sentence.",
        "intro": "A paragraph is 5-7 sentences all about ONE main idea.",
        "questions": [
            "What is a 'topic sentence'?",
            "Why should all your sentences be about one idea?",
            "Topic: 'My favourite season'. Write ONE topic sentence.",
            "Add a supporting detail (why is it your favourite?).",
            "Add another detail (something you do in that season).",
            "Add a sensory detail (what you SEE/SMELL/HEAR).",
            "Write a closing sentence (sum it up).",
            "Read your paragraph back — does every sentence fit the topic?",
            "Find and fix one spelling mistake (if any).",
            "Give your paragraph a title.",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 5
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g5-subject-verb-agreement",
        "grade": "Grade 5",
        "title": "Subject-Verb Agreement",
        "description": "Singular subject → singular verb. Plural → plural.",
        "intro": "'The dog runs' (one). 'The dogs run' (many). The verb must match!",
        "questions": [
            "Correct: 'The boy ___ (run/runs) fast.'",
            "Correct: 'The boys ___ (run/runs) fast.'",
            "Correct: 'My sister ___ (have/has) a bike.'",
            "Correct: 'My sisters ___ (have/has) bikes.'",
            "Correct: 'There ___ (is/are) two apples.'",
            "Correct: 'There ___ (is/are) a cat outside.'",
            "Fix: 'The dogs barks at strangers.'",
            "Fix: 'My friend live next door.'",
            "Singular or plural? 'Everybody'. Pick the verb: ___ (is/are) here.",
            "Singular or plural? 'The team'. Most often: ___ (is/are).",
        ],
    },
    {
        "id": "caps-eng-g5-synonyms-antonyms",
        "grade": "Grade 5",
        "title": "Synonyms and Antonyms",
        "description": "Same meaning vs opposite meaning.",
        "intro": "Synonym = same. Antonym = opposite. (Memory trick: 'syn' = same, 'ant' = against.)",
        "questions": [
            "Synonym for 'big': ___",
            "Synonym for 'happy': ___",
            "Synonym for 'fast': ___",
            "Synonym for 'scared': ___",
            "Antonym for 'hot': ___",
            "Antonym for 'kind': ___",
            "Antonym for 'early': ___",
            "Antonym for 'open': ___",
            "Are 'angry' and 'cross' synonyms or antonyms?",
            "Are 'tiny' and 'huge' synonyms or antonyms?",
        ],
    },
    {
        "id": "caps-eng-g5-direct-indirect-speech",
        "grade": "Grade 5",
        "title": "Direct and Indirect Speech",
        "description": "Reporting what someone said — with or without quotation marks.",
        "intro": "Direct: \"I am tired,\" she said. Indirect: She said that she was tired.",
        "questions": [
            "Direct or indirect: 'Mom said she was busy.'",
            "Direct or indirect: '\"Come here!\" shouted Dad.'",
            "Change to indirect: 'Tom said, \"I am hungry.\"'",
            "Change to indirect: 'She said, \"I love this book.\"'",
            "Change to direct: 'He said that he was happy.' (add quotes)",
            "What punctuation goes inside the quotes in direct speech?",
            "Whose words go INSIDE the quotation marks?",
            "Direct: '\"It is raining,\" said Sue.' Indirect form?",
            "Spot the mistake: 'He said \"that he was here.\"'",
            "Write a direct speech sentence. Use quotation marks correctly.",
        ],
    },
    {
        "id": "caps-eng-g5-comprehension-narrative",
        "grade": "Grade 5",
        "title": "Comprehension — The Missing Lunchbox",
        "description": "Narrative passage with character and conflict.",
        "intro": (
            "Read carefully.\n\n"
            "Nomsa opened her bag and gasped. Her lunchbox was gone! She had "
            "definitely packed it that morning — leftover chicken and a "
            "yoghurt. She retraced her steps. The library? No. The "
            "playground? No. Then she remembered: she had left it on the "
            "bus when she stopped to help a younger boy pick up his books. "
            "She told her teacher, who phoned the bus depot. By lunchtime, "
            "her box was back. Nomsa shared half her chicken with the "
            "younger boy."
        ),
        "questions": [
            "Who is the main character?",
            "What was missing?",
            "What was inside it?",
            "Where had she left it?",
            "Why did she leave it there?",
            "Who helped get it back?",
            "Why do you think Nomsa shared with the boy at the end?",
            "Find a word in the passage that means 'breathed in sharply with surprise'.",
            "Find a word that means 'where buses are kept'.",
            "What does this story say about kindness?",
        ],
    },
    {
        "id": "caps-eng-g5-adverbs",
        "grade": "Grade 5",
        "title": "Adverbs — Describing the Action",
        "description": "Adverbs describe VERBS. Often end in -ly.",
        "intro": "She sang BEAUTIFULLY. The adverb tells us HOW she sang.",
        "questions": [
            "Find the adverb: 'He ran quickly.'",
            "Find the adverb: 'She spoke softly.'",
            "Find the adverb: 'The dog wagged its tail happily.'",
            "Make an adverb from 'slow': ___",
            "Make an adverb from 'careful': ___",
            "Make an adverb from 'gentle': ___",
            "Add an adverb: 'She laughed ___.'",
            "Add an adverb: 'He answered ___.'",
            "Is 'today' an adverb? (Hint: when?)",
            "Is 'there' an adverb? (Hint: where?)",
        ],
    },
    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 6
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g6-active-passive",
        "grade": "Grade 6",
        "title": "Active vs Passive Voice",
        "description": "Who's doing the doing?",
        "intro": "Active: The cat ATE the fish. Passive: The fish WAS EATEN by the cat.",
        "questions": [
            "Active or passive: 'The teacher marked the books.'",
            "Active or passive: 'The books were marked by the teacher.'",
            "Active or passive: 'A loud noise woke me up.'",
            "Active or passive: 'I was woken up by a loud noise.'",
            "Change to passive: 'Jane wrote the letter.'",
            "Change to passive: 'The boy kicked the ball.'",
            "Change to active: 'The cake was eaten by the children.'",
            "Change to active: 'The window was broken by the wind.'",
            "Which is usually stronger writing — active or passive?",
            "When might passive be better than active?",
        ],
    },
    {
        "id": "caps-eng-g6-pronouns",
        "grade": "Grade 6",
        "title": "Pronouns — Subject, Object, Possessive",
        "description": "Words that replace nouns: I/me/mine, he/him/his, etc.",
        "intro": "Subject: I/he/she/we/they. Object: me/him/her/us/them. Possessive: my/his/her/our/their.",
        "questions": [
            "Pick: '___ are going to the park.' (We/Us)",
            "Pick: 'Mom called ___.' (I/me)",
            "Pick: 'That is ___ book.' (my/me)",
            "Pick: '___ is my best friend.' (Him/He)",
            "Pick: 'Give the keys to ___.' (he/him)",
            "Pick: 'The dog wagged ___ tail.' (its/it's)",
            "Replace with pronoun: 'Tom and Tim went home' → ___ went home.",
            "Replace with pronoun: 'I saw Sarah at the shops' → I saw ___ at the shops.",
            "What kind of pronoun is 'theirs'? (Subject / Object / Possessive)",
            "Fix: 'Me and him went to the movies.'",
        ],
    },
    {
        "id": "caps-eng-g6-conjunctions",
        "grade": "Grade 6",
        "title": "Conjunctions — Linking Words",
        "description": "And, but, or, because, although... they connect ideas.",
        "intro": "FANBOYS = For, And, Nor, But, Or, Yet, So. The 7 simple connectors.",
        "questions": [
            "Add a conjunction: 'I was tired ___ I went to bed.'",
            "Add a conjunction: 'She likes tea ___ coffee.'",
            "Add a conjunction: 'He ran fast ___ still missed the bus.'",
            "Add a conjunction: 'I'll come ___ you ask nicely.'",
            "Add a conjunction: '___ it was raining, we went to the beach.'",
            "What does 'because' tell us? (cause / time / contrast)",
            "What does 'although' tell us? (cause / time / contrast)",
            "Combine: 'It was hot. I drank water.' (use 'so')",
            "Combine: 'I like soccer. My brother likes cricket.' (use 'but')",
            "Combine: 'We waited. The bus arrived.' (use 'until')",
        ],
    },
    {
        "id": "caps-eng-g6-comprehension-information",
        "grade": "Grade 6",
        "title": "Comprehension — How Bees Work",
        "description": "Information text — find the facts and explain.",
        "intro": (
            "Read carefully.\n\n"
            "Bees are some of the most important animals on Earth. Without "
            "them, many plants would not be pollinated, and we would have "
            "much less food. A bee colony has three types of bees: a queen, "
            "worker bees, and drones. The queen lays all the eggs — up to "
            "2000 per day! Workers (all female) gather nectar, build the "
            "honeycomb, and protect the hive. Drones are male bees whose "
            "only job is to mate with the queen. When a worker bee finds a "
            "good flower patch, she returns to the hive and dances. The "
            "shape of her dance tells the other bees where to fly."
        ),
        "questions": [
            "Why are bees important?",
            "How many types of bees are in a colony?",
            "What does the queen do?",
            "What jobs do workers do? (Give 2)",
            "What is the drone's job?",
            "How do worker bees tell each other where flowers are?",
            "Are all worker bees male or female?",
            "Find a word meaning 'when pollen moves from one plant to another'.",
            "Why might fewer bees mean less food for humans?",
            "What's the most surprising fact in this passage, in your opinion?",
        ],
    },
    {
        "id": "caps-eng-g6-essay-structure",
        "grade": "Grade 6",
        "title": "Essay Structure — Introduction, Body, Conclusion",
        "description": "How to organise a short essay (3-5 paragraphs).",
        "intro": "Intro = tell them what you'll say. Body = say it. Conclusion = wrap up.",
        "questions": [
            "What goes in the introduction?",
            "What goes in the body?",
            "What goes in the conclusion?",
            "Topic: 'Why kids should play sport.' Write a one-sentence intro.",
            "Write 1 body paragraph point: 'Sport is good because ___.'",
            "Write a 2nd body point.",
            "Write a 3rd body point.",
            "Write a 1-sentence conclusion that sums up your three points.",
            "Why is a hook (interesting opening) useful?",
            "Read your essay aloud. Does each paragraph connect to the topic?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g7-figurative-language",
        "grade": "Grade 7",
        "title": "Figurative Language — Simile, Metaphor, Personification",
        "description": "When writers say one thing but mean another for effect.",
        "intro": (
            "Simile = compares using 'like' or 'as'. Metaphor = says it IS. "
            "Personification = gives human qualities to non-human things."
        ),
        "questions": [
            "'Brave as a lion' — simile or metaphor?",
            "'He is a lion in battle' — simile or metaphor?",
            "'The wind whispered to the trees' — what figure of speech?",
            "'Her smile was sunshine' — simile or metaphor?",
            "'The stars danced in the sky' — what figure of speech?",
            "Make a simile about a fast car.",
            "Make a metaphor about a strict teacher.",
            "Make a personification sentence about the rain.",
            "What does 'time flies' mean? Why is it figurative?",
            "Find a figurative phrase you've heard adults use, and explain it.",
        ],
    },
    {
        "id": "caps-eng-g7-comprehension-argument",
        "grade": "Grade 7",
        "title": "Comprehension — The Phones-in-School Debate",
        "description": "Argumentative passage. Spot the writer's opinion + evidence.",
        "intro": (
            "Read.\n\n"
            "Many schools have banned cellphones during lessons. Supporters "
            "say phones distract students from learning, encourage "
            "cyberbullying, and make cheating easier. Studies have shown "
            "that test scores improve in schools that ban phones during "
            "class. Critics argue that phones are essential safety tools and "
            "that students must learn to manage technology responsibly. "
            "They suggest that teaching balance is more useful than enforcing "
            "a total ban. Both sides care about student wellbeing — they "
            "just disagree on the best way forward."
        ),
        "questions": [
            "What is the main topic?",
            "Give two reasons supporters want phones banned.",
            "Give two reasons critics oppose the ban.",
            "What evidence does the writer give for banning?",
            "Does the writer take a side? How can you tell?",
            "What does 'enforcing' mean in this passage?",
            "What does 'wellbeing' mean?",
            "What is YOUR opinion on phones in school? Give one reason.",
            "What's one fact in the passage? What's one opinion?",
            "Write a one-sentence summary of the whole passage.",
        ],
    },
    {
        "id": "caps-eng-g7-phrases-clauses",
        "grade": "Grade 7",
        "title": "Phrases and Clauses",
        "description": "Phrase = group of words. Clause = has a subject + verb.",
        "intro": "Clause: 'I ran' (has subject + verb). Phrase: 'in the park' (no verb).",
        "questions": [
            "Phrase or clause: 'on the table'?",
            "Phrase or clause: 'she laughed'?",
            "Phrase or clause: 'after the game'?",
            "Phrase or clause: 'because it was raining'?",
            "Phrase or clause: 'a big red ball'?",
            "Find the clause: 'When I arrived, the show had started.'",
            "Find the phrase: 'The boy in the blue shirt is my brother.'",
            "Add a phrase: 'The cat sat ___.'",
            "Add a clause: 'I went home ___.'",
            "What's the difference between a phrase and a clause in your own words?",
        ],
    },
    {
        "id": "caps-eng-g7-punctuation-advanced",
        "grade": "Grade 7",
        "title": "Advanced Punctuation — Colon, Semicolon, Apostrophe",
        "description": "When and why to use the trickier marks.",
        "intro": "Colon : introduces lists or explanations. Semicolon ; joins two related sentences. Apostrophe ' shows possession or contraction.",
        "questions": [
            "Add a colon: 'I need three things ___ a pen, paper, and a book.'",
            "Add a semicolon: 'It was late ___ I went to bed.'",
            "Apostrophe — possession: 'the dog ___ s bone'",
            "Apostrophe — contraction: 'do not' = ___",
            "Apostrophe — contraction: 'I am' = ___",
            "Fix: 'Its' raining outside. (its or it's?)",
            "Fix: 'The boys book is on the desk.' (one boy)",
            "Fix: 'The boys books are on the desk.' (many boys)",
            "Where does the apostrophe go: 'childrens toys' or 'children's toys'?",
            "Use a colon AND a list in one sentence of your own.",
        ],
    },
    {
        "id": "caps-eng-g7-persuasive-techniques",
        "grade": "Grade 7",
        "title": "Persuasive Writing Techniques",
        "description": "How writers convince you to agree.",
        "intro": "Common techniques: rhetorical questions, repetition, emotional words, statistics, expert quotes.",
        "questions": [
            "What is a 'rhetorical question'?",
            "Spot the rhetorical question: 'Who wouldn't want to be healthier?'",
            "Spot the emotional word: 'This terrible decision will hurt our community.'",
            "Why might a writer use statistics?",
            "Why might a writer use repetition?",
            "Write a sentence using a rhetorical question to persuade.",
            "Write a sentence using emotional words to persuade.",
            "Write a sentence using a (made-up) statistic to persuade.",
            "Pick a cause you care about. Give one persuasive argument.",
            "Why is it important to recognise these techniques in adverts?",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 8
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g8-sentence-structure",
        "grade": "Grade 8",
        "title": "Sentence Structure — Simple, Compound, Complex",
        "description": "Mixing sentence types makes writing flow.",
        "intro": "Simple = 1 clause. Compound = 2 main clauses joined (and/but/or). Complex = main + subordinate clause.",
        "questions": [
            "Identify: 'The bell rang.' (simple/compound/complex)",
            "Identify: 'The bell rang, and we left.' (simple/compound/complex)",
            "Identify: 'When the bell rang, we left.' (simple/compound/complex)",
            "Identify: 'I went home because I was tired.' (simple/compound/complex)",
            "Identify: 'I went home, but Tom stayed.' (simple/compound/complex)",
            "Combine into a compound sentence: 'I was hungry. I ate.'",
            "Combine into a complex sentence using 'although': 'I was tired. I kept working.'",
            "Make a simple sentence about the weather.",
            "Make a compound sentence about the weekend.",
            "Make a complex sentence about your favourite subject.",
        ],
    },
    {
        "id": "caps-eng-g8-modifiers",
        "grade": "Grade 8",
        "title": "Dangling and Misplaced Modifiers",
        "description": "When describing words attach to the wrong thing — usually funny.",
        "intro": "A modifier should sit close to the thing it describes. Otherwise the sentence gets confusing or hilarious.",
        "questions": [
            "Fix: 'Walking to school, the rain started pouring.' (Who was walking?)",
            "Fix: 'I saw a dog on my way to school that was barking loudly.' (What was barking?)",
            "Fix: 'Running quickly, the bus was caught.' (Who was running?)",
            "Fix: 'She only eats vegetables on Tuesdays.' (Only Tuesdays — or only vegetables?)",
            "Where should 'almost' go: 'I almost ate all the pizza' vs 'I ate almost all the pizza'?",
            "Fix: 'Covered in mud, mom told me to bath.'",
            "Fix: 'The cake was given to the children with icing.'",
            "Fix: 'I saw a man with a telescope.' (Who has the telescope?)",
            "Why do dangling modifiers happen?",
            "Write one sentence with a clearly placed modifier.",
        ],
    },
    {
        "id": "caps-eng-g8-poetry-analysis",
        "grade": "Grade 8",
        "title": "Poetry — Rhyme, Rhythm, Theme",
        "description": "Reading a poem isn't just for the meaning — it's for the music.",
        "intro": (
            "Read the short poem.\n\n"
            "The Storm\n"
            "The thunder cracked, the lightning flashed,\n"
            "The rain came down in sheets;\n"
            "The wind howled wild, the windows crashed,\n"
            "The whole town held its breath."
        ),
        "questions": [
            "How many lines are in the poem?",
            "Find a pair of rhyming words.",
            "What's the rhyme scheme? (A B A B, A A B B, etc.)",
            "Spot a personification.",
            "Spot a verb that sounds like the action (onomatopoeia).",
            "What is the theme/mood of the poem?",
            "Which line feels strongest to you? Why?",
            "What does 'held its breath' mean here?",
            "Why does the poet use so many strong verbs?",
            "Write a single line of your own about a storm.",
        ],
    },
    {
        "id": "caps-eng-g8-comprehension-literary",
        "grade": "Grade 8",
        "title": "Comprehension — A Literary Passage",
        "description": "Fiction with character emotion. Read between the lines.",
        "intro": (
            "Read.\n\n"
            "Thandi stared at the envelope on her desk. She had been waiting "
            "for this letter for weeks, and now that it was here she "
            "couldn't bring herself to open it. Inside was an answer she "
            "wasn't sure she wanted. She picked it up, put it down. Picked "
            "it up again. The room felt very quiet. Outside, life went on — "
            "a dog barked, a car passed, a child shouted somewhere down the "
            "street. Inside, time had stopped. She took a deep breath, "
            "tore open the envelope, and began to read."
        ),
        "questions": [
            "Who is the main character?",
            "What is she holding?",
            "How does she feel about it? (Use evidence from the text.)",
            "Why might she 'not be sure she wanted' the answer?",
            "Find a contrast the writer uses (inside vs outside).",
            "What effect does the contrast create?",
            "What does 'time had stopped' mean (figuratively)?",
            "Find a sentence that shows hesitation through its rhythm.",
            "Imagine the letter's content. What might it say?",
            "What do you think she does next?",
        ],
    },
    {
        "id": "caps-eng-g8-narrative-essay",
        "grade": "Grade 8",
        "title": "Writing a Narrative Essay",
        "description": "Telling a personal story with shape and feeling.",
        "intro": "Hook + setup + rising action + climax + resolution. Show, don't tell.",
        "questions": [
            "Pick a real event from your life worth writing about.",
            "Write a one-sentence HOOK (intriguing opener).",
            "Set the scene in 1-2 sentences (where, when).",
            "What is the rising tension? (what was the problem/excitement?)",
            "What is the climax (the BIG moment)?",
            "How does it resolve?",
            "Add ONE sensory detail (smell, sound, touch).",
            "Show feeling WITHOUT saying 'I felt happy' — show through action.",
            "Read aloud. Where does the pace lag?",
            "Write a one-sentence ending that lands.",
        ],
    },
    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 9
    # ------------------------------------------------------------------
    {
        "id": "caps-eng-g9-literary-devices",
        "grade": "Grade 9",
        "title": "Literary Devices — Irony, Foreshadowing, Symbolism",
        "description": "The tools writers use to layer meaning.",
        "intro": "Irony = the opposite of what's expected. Foreshadowing = hints of what's to come. Symbolism = an object that stands for something bigger.",
        "questions": [
            "Define irony in your own words.",
            "Define foreshadowing.",
            "Define symbolism.",
            "Example of irony: a fire station burns down. Why is this ironic?",
            "Identify the device: a dark cloud appears just before bad news.",
            "Identify the device: a dove represents peace.",
            "Identify the device: a vegetarian wins a steak prize.",
            "Why would a writer use foreshadowing?",
            "Pick a symbol you've seen in a movie. What did it stand for?",
            "Write a one-sentence example of irony.",
        ],
    },
    {
        "id": "caps-eng-g9-comprehension-shakespeare",
        "grade": "Grade 9",
        "title": "Comprehension — A Speech from Shakespeare",
        "description": "Reading early modern English. The language is older but the feelings are familiar.",
        "intro": (
            "Read.\n\n"
            "All the world's a stage,\n"
            "And all the men and women merely players;\n"
            "They have their exits and their entrances,\n"
            "And one man in his time plays many parts...\n"
            "  — Jaques, As You Like It (William Shakespeare)"
        ),
        "questions": [
            "Who wrote this?",
            "What does 'the world's a stage' compare the world to?",
            "Is that a simile or metaphor?",
            "What does 'players' mean here?",
            "What does 'one man in his time plays many parts' mean?",
            "Rewrite the first line in modern English.",
            "Why might Shakespeare have chosen the theatre as a comparison?",
            "What life stages might be the 'many parts'?",
            "What is the overall tone — playful, serious, sad?",
            "Do you agree life is like a play? Why or why not?",
        ],
    },
    {
        "id": "caps-eng-g9-tone-register",
        "grade": "Grade 9",
        "title": "Tone and Register",
        "description": "Tone = attitude. Register = formality level.",
        "intro": "Same idea, different words: 'I'm hungry' vs 'I have a touch of an appetite' vs 'I'm starving, bru'.",
        "questions": [
            "Formal or informal: 'Hi mate, what's up?'",
            "Formal or informal: 'Good afternoon, may I assist you?'",
            "Formal or informal: 'Yo, bring the snacks please!'",
            "What tone is angry: harsh words, short sentences, exclamations.",
            "What tone is sympathetic: gentle words, slow sentences.",
            "Rewrite formally: 'Hey teacher, my homework is so dead.'",
            "Rewrite informally: 'I respectfully request a reschedule of the meeting.'",
            "What tone fits a job application — formal or informal?",
            "What tone fits a WhatsApp to a friend?",
            "Match the audience to the register: WhatsApp to mom, email to principal, speech at a wedding.",
        ],
    },
    {
        "id": "caps-eng-g9-argumentative-essay",
        "grade": "Grade 9",
        "title": "Argumentative Essay Structure",
        "description": "Take a position. Defend it with evidence. Address the other side.",
        "intro": "Intro (with thesis) → body (3+ arguments with evidence) → counter-argument (and rebuttal) → conclusion.",
        "questions": [
            "What is a 'thesis statement'?",
            "Topic: 'School uniforms should be compulsory.' Write a one-sentence thesis (your position).",
            "Give one argument FOR your position.",
            "Provide one piece of evidence (fact, example, or expert opinion).",
            "Give a second argument.",
            "Give a third argument.",
            "What is a 'counter-argument'?",
            "What is a 'rebuttal'?",
            "Write a one-sentence counter-argument someone might make.",
            "Write a one-sentence rebuttal of it.",
        ],
    },
    {
        "id": "caps-eng-g9-editing-proofreading",
        "grade": "Grade 9",
        "title": "Editing and Proofreading",
        "description": "The grown-up skill of finding your own mistakes.",
        "intro": "Read your work backwards (sentence by sentence) to catch errors your eyes 'fix' automatically.",
        "questions": [
            "Fix: 'Their going to the shop'.",
            "Fix: 'Me and her went home'.",
            "Fix: 'I should of called you'.",
            "Fix: 'The team are winning' (in formal SA English).",
            "Find the error: 'She runned to school yesterday.'",
            "Find the error: 'Each of the boys have a hat.'",
            "Find the error: 'Between you and I, this is a secret.'",
            "Find the error: 'The book that I read it was great.'",
            "Why is reading aloud a good editing tool?",
            "Name one common error YOU often make in writing.",
        ],
    },
]


def build_extracted_text(ws: dict) -> str:
    """Produce the extracted_text string in the shape Echo expects."""
    lines = [
        f"{ws['title']} - {ws['grade']}",
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
        Paragraph(f"{ws['grade']} - CAPS - CU3E", sub),
        Paragraph(ws["intro"].replace("\n", "<br/>"), intro),
    ]
    for i, qtext in enumerate(ws["questions"], start=1):
        story.append(Paragraph(f"<b>Q{i}.</b> &nbsp; {qtext}", q))
        story.append(Spacer(1, 4))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Supabase plumbing  (duplicated from seed_caps_foundation.py — per-subject
# scripts stay independent on purpose. If this becomes 5+ subjects it's worth
# factoring into a shared seed_lib.py.)
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


def wipe_existing_english_rows(env: dict) -> int:
    """DELETE only rows in this script's subject; leaves Maths etc. alone."""
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
        "source_attribution": "CU3E CAPS English pack",
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
    wiped = wipe_existing_english_rows(env)
    print(f"  removed {wiped} stale rows")
    print(f"Seeding {len(WORKSHEETS)} CAPS English worksheets (Grades 1-9)...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} English packs in the Study Hub library.")


if __name__ == "__main__":
    main()
