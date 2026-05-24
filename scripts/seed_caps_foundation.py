"""
CAPS Maths starter pack — all grades, one-shot seeder.

Generates ~45 Maths worksheets covering CAPS Grade 1 through Grade 9
(Foundation, Intermediate, Senior Phases), renders each to a PDF via
reportlab, uploads to Supabase Storage under curriculum/library/, and
inserts a curriculum_library row per pack with extracted_text already
populated so activation is instant and skips the Claude vision call.

Run from the website-app directory:
    python3 scripts/seed_caps_foundation.py

Requires:
    pip install reportlab

Env (read from .env.local):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Idempotent: at the start it DELETEs all existing CAPS rows from
curriculum_library, then re-inserts the current WORKSHEETS list.
Re-run anytime to update the catalogue.
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

# ---------------------------------------------------------------------------
# CAPS Maths Grades 1-9
# ---------------------------------------------------------------------------

WORKSHEETS = [
    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 1
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 2
    # ------------------------------------------------------------------
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
    {
        "id": "caps-g2-adding-to-20",
        "grade": "Grade 2",
        "title": "Adding to 20",
        "description": "Adding within 20 including crossing the 10.",
        "intro": "Add the numbers. Bridge over 10 if you need to.",
        "questions": [
            "8 + 5 = ?",
            "7 + 6 = ?",
            "9 + 4 = ?",
            "6 + 7 = ?",
            "8 + 8 = ?",
            "9 + 9 = ?",
            "12 + 3 = ?",
            "14 + 5 = ?",
            "Sipho has 9 stickers. He gets 6 more. How many?",
            "There are 7 cars in the parking lot. 8 more arrive. How many in total?",
        ],
    },
    {
        "id": "caps-g2-time-oclock-halfpast",
        "grade": "Grade 2",
        "title": "Time — O'Clock and Half-Past",
        "description": "Reading clocks at the o'clock and half-past marks.",
        "intro": "The big hand on 12 = o'clock. Big hand on 6 = half-past.",
        "questions": [
            "Big hand on 12, small hand on 3 — what time?",
            "Big hand on 12, small hand on 7 — what time?",
            "Big hand on 6, small hand between 4 and 5 — what time?",
            "What time is 1 hour after 5 o'clock?",
            "What time is 30 minutes after 8 o'clock?",
            "Is half-past 10 the same as 10:30?",
            "How many minutes in an hour?",
            "How many hours in a day?",
            "School starts at 8 o'clock. What time is 2 hours later?",
            "What comes first: half-past 4 or 5 o'clock?",
        ],
    },
    {
        "id": "caps-g2-money-rands-cents",
        "grade": "Grade 2",
        "title": "Money — Rands and Cents",
        "description": "Counting SA money. R coins and notes.",
        "intro": "100 cents = R1.",
        "questions": [
            "How many R1 coins make R5?",
            "How many R2 coins make R10?",
            "Two R5 coins + one R10 note = ?",
            "Three R20 notes = ?",
            "Lerato has R8 + R5. How much?",
            "A loaf of bread costs R15. You pay with R20. Change?",
            "How many R5 coins make R25?",
            "R50 note + R20 note = ?",
            "You buy a R12 toy and a R7 sweet. Total?",
            "How many cents in R3?",
        ],
    },

    # ------------------------------------------------------------------
    # FOUNDATION PHASE — Grade 3
    # ------------------------------------------------------------------
    {
        "id": "caps-g3-times-tables-3s-4s",
        "grade": "Grade 3",
        "title": "Times Tables — 3s and 4s",
        "description": "Adding the 3× and 4× tables to your repertoire.",
        "intro": "Skip count to find the answer if you're not sure.",
        "questions": [
            "3 × 3 = ?",
            "5 × 3 = ?",
            "7 × 3 = ?",
            "9 × 3 = ?",
            "2 × 4 = ?",
            "4 × 4 = ?",
            "6 × 4 = ?",
            "8 × 4 = ?",
            "10 × 3 = ?",
            "10 × 4 = ?",
        ],
    },
    {
        "id": "caps-g3-adding-2-digit",
        "grade": "Grade 3",
        "title": "Adding 2-Digit Numbers",
        "description": "Adding two-digit numbers with and without regrouping.",
        "intro": "Line up the tens and ones. Carry when ones make 10 or more.",
        "questions": [
            "23 + 14 = ?",
            "35 + 22 = ?",
            "47 + 28 = ?",
            "56 + 19 = ?",
            "38 + 45 = ?",
            "67 + 25 = ?",
            "29 + 36 = ?",
            "74 + 18 = ?",
            "There are 38 girls and 27 boys in two classes. How many learners?",
            "A book costs R45 and a pen R29. Total spent?",
        ],
    },
    {
        "id": "caps-g3-subtracting-2-digit",
        "grade": "Grade 3",
        "title": "Subtracting 2-Digit Numbers",
        "description": "Two-digit subtraction including borrowing across tens.",
        "intro": "Line up tens and ones. Borrow from the tens when the top digit is smaller.",
        "questions": [
            "47 − 23 = ?",
            "58 − 31 = ?",
            "82 − 47 = ?",
            "63 − 28 = ?",
            "91 − 56 = ?",
            "75 − 38 = ?",
            "100 − 45 = ?",
            "84 − 29 = ?",
            "Nomsa has R85. She spends R47. How much left?",
            "There were 72 sweets. 39 were eaten. How many remain?",
        ],
    },
    {
        "id": "caps-g3-halves-and-quarters",
        "grade": "Grade 3",
        "title": "Halves and Quarters",
        "description": "First fractions — splitting things in half and into quarters.",
        "intro": "Half = 1/2 = 2 equal pieces. Quarter = 1/4 = 4 equal pieces.",
        "questions": [
            "How many halves in 1 whole?",
            "How many quarters in 1 whole?",
            "How many quarters in 1 half?",
            "Half of 10 = ?",
            "Half of 8 = ?",
            "Quarter of 8 = ?",
            "Quarter of 12 = ?",
            "Half of 20 = ?",
            "If you eat 1 quarter of a pizza, how many quarters are left?",
            "Three children share 1 pizza fairly. What fraction does each get? (hint: thirds)",
        ],
    },
    {
        "id": "caps-g3-time-quarter-past",
        "grade": "Grade 3",
        "title": "Time — Quarter Past and Quarter To",
        "description": "Reading and writing time including quarters.",
        "intro": "Quarter past = 15 min after the hour. Quarter to = 15 min before the next hour.",
        "questions": [
            "Quarter past 3 — in digital time?",
            "Quarter to 5 — in digital time?",
            "What time is 15 minutes after 7 o'clock?",
            "What time is 15 minutes before 9 o'clock?",
            "Is half-past 6 the same as 6:30?",
            "Is quarter past 4 the same as 4:15?",
            "How many minutes between 3:00 and 3:30?",
            "How many minutes between 3:15 and 3:45?",
            "School ends at quarter past 2. Write that as digital time.",
            "Tatum starts homework at half-past 4 and finishes at quarter past 5. How long?",
        ],
    },

    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 4
    # ------------------------------------------------------------------
    {
        "id": "caps-g4-times-tables-6-7-8-9",
        "grade": "Grade 4",
        "title": "Times Tables — 6s, 7s, 8s, 9s",
        "description": "The trickier times tables. Fluency by Grade 4 end.",
        "intro": "Memorise these — they show up everywhere.",
        "questions": [
            "6 × 7 = ?",
            "8 × 6 = ?",
            "7 × 9 = ?",
            "8 × 8 = ?",
            "9 × 6 = ?",
            "7 × 7 = ?",
            "9 × 8 = ?",
            "6 × 6 = ?",
            "7 × 8 = ?",
            "9 × 9 = ?",
        ],
    },
    {
        "id": "caps-g4-long-division",
        "grade": "Grade 4",
        "title": "Long Division — 2-digit ÷ 1-digit",
        "description": "Dividing a 2-digit number by a single digit. Watch for remainders.",
        "intro": "How many times does the divisor go into each digit, left to right.",
        "questions": [
            "48 ÷ 2 = ?",
            "63 ÷ 3 = ?",
            "84 ÷ 4 = ?",
            "75 ÷ 5 = ?",
            "92 ÷ 4 = ? (remainder?)",
            "55 ÷ 6 = ? (remainder?)",
            "96 ÷ 8 = ?",
            "81 ÷ 9 = ?",
            "Share 72 sweets between 6 children. How many each?",
            "65 ÷ 7 = ? (remainder?)",
        ],
    },
    {
        "id": "caps-g4-equivalent-fractions",
        "grade": "Grade 4",
        "title": "Equivalent Fractions",
        "description": "Different fractions that mean the same amount.",
        "intro": "Multiply top and bottom by the same number → equivalent fraction.",
        "questions": [
            "1/2 = ?/4",
            "1/2 = ?/6",
            "1/3 = ?/6",
            "2/3 = ?/6",
            "1/4 = ?/8",
            "3/4 = ?/8",
            "Is 2/4 the same as 1/2?",
            "Is 3/6 the same as 1/2?",
            "Write three equivalent fractions for 1/2.",
            "Which is bigger: 1/3 or 1/4?",
        ],
    },
    {
        "id": "caps-g4-decimals-intro",
        "grade": "Grade 4",
        "title": "Decimal Numbers",
        "description": "Decimals to two places. Reading + writing them.",
        "intro": "0,5 means 'zero point five' — half. 0,25 means 'zero point two five' — a quarter.",
        "questions": [
            "Write 'half' as a decimal.",
            "Write 'a quarter' as a decimal.",
            "Write 'three quarters' as a decimal.",
            "Which is bigger: 0,4 or 0,7?",
            "Which is bigger: 0,5 or 0,45?",
            "0,5 + 0,5 = ?",
            "1,0 − 0,3 = ?",
            "Order: 0,1; 0,9; 0,5 (smallest to biggest)",
            "Write 25 cents as a decimal of a Rand (R___).",
            "Write R3,75 in cents.",
        ],
    },
    {
        "id": "caps-g4-perimeter",
        "grade": "Grade 4",
        "title": "Perimeter of Rectangles",
        "description": "Distance around the outside of a shape.",
        "intro": "Add up the lengths of all the sides.",
        "questions": [
            "Rectangle with sides 5 cm and 3 cm — perimeter?",
            "Square with side 4 cm — perimeter?",
            "Rectangle 8 cm by 2 cm — perimeter?",
            "Square with side 7 cm — perimeter?",
            "Rectangle 10 cm by 6 cm — perimeter?",
            "If perimeter of a square is 20 cm, length of one side?",
            "Rectangle 9 m by 5 m — perimeter in metres?",
            "Square with side 12 cm — perimeter?",
            "Garden 15 m long, 8 m wide. Fence needed = ?",
            "Triangle with sides 4 cm, 5 cm, 6 cm — perimeter?",
        ],
    },

    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 5
    # ------------------------------------------------------------------
    {
        "id": "caps-g5-fractions-add-subtract",
        "grade": "Grade 5",
        "title": "Adding and Subtracting Fractions",
        "description": "Same-denominator first; then equivalent fractions for different ones.",
        "intro": "Same bottom number? Just add the tops. Different? Find a common denominator first.",
        "questions": [
            "1/4 + 2/4 = ?",
            "3/5 + 1/5 = ?",
            "5/6 − 2/6 = ?",
            "1/2 + 1/4 = ?",
            "2/3 + 1/6 = ?",
            "3/4 − 1/2 = ?",
            "1/3 + 1/6 = ?",
            "5/8 − 1/4 = ?",
            "Ella ate 1/4 of a pizza, Tatum ate 1/2. How much together?",
            "Of a R60 budget, 1/3 was spent. How much left?",
        ],
    },
    {
        "id": "caps-g5-decimal-arithmetic",
        "grade": "Grade 5",
        "title": "Decimal Arithmetic",
        "description": "Adding, subtracting and ordering decimals to 2 places.",
        "intro": "Line up the decimal points before adding or subtracting.",
        "questions": [
            "2,5 + 1,3 = ?",
            "4,75 + 2,15 = ?",
            "6,8 − 2,3 = ?",
            "10,0 − 4,75 = ?",
            "3,5 × 2 = ?",
            "Order: 1,5; 1,25; 1,8; 1,07 (smallest first)",
            "R12,50 + R8,75 = ?",
            "R20,00 − R7,45 = ?",
            "0,1 + 0,1 + 0,1 = ?",
            "Round 4,67 to one decimal place.",
        ],
    },
    {
        "id": "caps-g5-percentages-intro",
        "grade": "Grade 5",
        "title": "Percentages — 10%, 25%, 50%, 75%, 100%",
        "description": "Percentages as fractions of 100. The friendly common ones.",
        "intro": "% means 'out of 100'. 50% = half. 25% = quarter.",
        "questions": [
            "50% of 80 = ?",
            "25% of 40 = ?",
            "10% of 200 = ?",
            "75% of 100 = ?",
            "100% of 50 = ?",
            "What is 10% of R150?",
            "If a shirt is 25% off R200, how much off?",
            "50% of a class of 30 = ?",
            "75% of 200 = ?",
            "If you score 8 out of 10, what percent?",
        ],
    },
    {
        "id": "caps-g5-volume-of-boxes",
        "grade": "Grade 5",
        "title": "Volume of Boxes",
        "description": "Volume of a rectangular box. Length × width × height.",
        "intro": "Volume in cubic units = L × W × H.",
        "questions": [
            "Box 3 cm × 2 cm × 4 cm — volume?",
            "Cube with side 5 cm — volume?",
            "Box 10 × 5 × 2 cm — volume?",
            "Cube with side 3 cm — volume?",
            "Box 6 × 4 × 5 cm — volume?",
            "Length 4, width 4, height 4 — volume?",
            "Pack 12 cubes of side 1 cm. What box shape works? (give one option)",
            "Box 2 × 2 × 2 cm — volume?",
            "How many cubic centimetres in 1 litre? (clue: 1000)",
            "Box 5 × 5 × 4 cm — volume?",
        ],
    },
    {
        "id": "caps-g5-angles",
        "grade": "Grade 5",
        "title": "Angles — Acute, Right, Obtuse, Straight",
        "description": "Naming and recognising angle types.",
        "intro": "Right = 90°. Acute = less than 90°. Obtuse = between 90° and 180°. Straight = 180°.",
        "questions": [
            "What is a right angle in degrees?",
            "What is a straight angle in degrees?",
            "Is 45° acute, right, or obtuse?",
            "Is 120° acute, right, or obtuse?",
            "Is 90° acute, right, or obtuse?",
            "Two right angles together = ?°",
            "180° − 45° = ?° (acute or obtuse?)",
            "Angles in a triangle add to ?°",
            "Angles around a point add to ?°",
            "Name the angle at the corner of a textbook.",
        ],
    },

    # ------------------------------------------------------------------
    # INTERMEDIATE PHASE — Grade 6
    # ------------------------------------------------------------------
    {
        "id": "caps-g6-bodmas",
        "grade": "Grade 6",
        "title": "Order of Operations — BODMAS",
        "description": "Brackets, Orders, Division, Multiplication, Addition, Subtraction.",
        "intro": "Brackets first, then ×/÷ left-to-right, then +/− left-to-right.",
        "questions": [
            "2 + 3 × 4 = ?",
            "(2 + 3) × 4 = ?",
            "10 − 6 ÷ 2 = ?",
            "(10 − 6) ÷ 2 = ?",
            "5 + 2 × 3 − 1 = ?",
            "20 ÷ 4 + 3 × 2 = ?",
            "(8 + 4) ÷ (3 × 2) = ?",
            "3² + 4 × 2 = ?",
            "12 − (3 + 2) × 2 = ?",
            "100 ÷ (5 × 2) = ?",
        ],
    },
    {
        "id": "caps-g6-ratio",
        "grade": "Grade 6",
        "title": "Ratio and Proportion",
        "description": "Comparing quantities. Sharing in a ratio.",
        "intro": "Ratio 2:3 means 'for every 2 of one, there are 3 of the other'.",
        "questions": [
            "Simplify the ratio 4:8.",
            "Simplify the ratio 10:15.",
            "Share R30 in the ratio 2:3.",
            "Share 20 sweets between 2 children in the ratio 3:1.",
            "Recipe needs flour and sugar in ratio 3:1. If flour = 6 cups, sugar = ?",
            "A bag has 12 red and 18 blue marbles. Simplify the ratio.",
            "Convert ratio 1:4 to a fraction (of the second item).",
            "Two friends share R100 in ratio 3:7. How much each?",
            "If 1 cm on map = 5 km in real life, then 4 cm = ?",
            "If 3 pens cost R15, how much do 7 pens cost?",
        ],
    },
    {
        "id": "caps-g6-mean-median-mode",
        "grade": "Grade 6",
        "title": "Mean, Median, Mode",
        "description": "Three different 'averages' of a dataset.",
        "intro": "Mean = add all, divide by count. Median = middle value. Mode = most common.",
        "questions": [
            "Find the mean: 2, 4, 6, 8.",
            "Find the median: 3, 5, 7, 9, 11.",
            "Find the mode: 2, 3, 3, 4, 5, 3, 6.",
            "Find the mean: 10, 15, 20.",
            "Find the median: 1, 4, 8, 10, 12, 15, 20.",
            "Find the mode: 5, 5, 6, 7, 8, 5, 9.",
            "If the mean of 4 numbers is 10, what is their total?",
            "Find the mean: 20, 30, 40, 50.",
            "A class has marks 60, 70, 80, 90, 100 — find the median.",
            "Find all three (mean, median, mode): 2, 3, 3, 4, 5.",
        ],
    },
    {
        "id": "caps-g6-coordinates",
        "grade": "Grade 6",
        "title": "Coordinates on a Grid",
        "description": "Plotting and reading points using (x, y) notation.",
        "intro": "x first (across), y second (up). Origin = (0, 0).",
        "questions": [
            "What are the coordinates of the origin?",
            "Where is (3, 0)? On which axis?",
            "Where is (0, 5)? On which axis?",
            "From (0, 0), how do you get to (4, 3)?",
            "What does the x-coordinate tell you?",
            "What does the y-coordinate tell you?",
            "A square has corners at (1,1), (4,1), (4,4) and ?",
            "Plot (2, 5) and (5, 2). Are these the same point?",
            "Move (3, 4) right by 2 — new coordinates?",
            "Move (5, 5) down by 3 — new coordinates?",
        ],
    },
    {
        "id": "caps-g6-triangle-properties",
        "grade": "Grade 6",
        "title": "Properties of Triangles",
        "description": "Equilateral, isosceles, scalene. Right-angled triangles.",
        "intro": "Equilateral = all 3 sides equal. Isosceles = 2 sides equal. Scalene = all different.",
        "questions": [
            "Angles in any triangle add up to ?°.",
            "All sides equal — what kind of triangle?",
            "Two sides equal — what kind?",
            "One 90° angle — what kind?",
            "A triangle has angles 50° and 60°. Find the third.",
            "A triangle has angles 90° and 45°. Find the third.",
            "Equilateral triangle — each angle = ?°",
            "Can a triangle have two 90° angles? Why / why not?",
            "Right-angled triangle with two 45° angles — what shape?",
            "Triangle has sides 5 cm, 5 cm, 8 cm. Name the type.",
        ],
    },

    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 7
    # ------------------------------------------------------------------
    {
        "id": "caps-g7-integers",
        "grade": "Grade 7",
        "title": "Integers — Negative Numbers",
        "description": "Adding, subtracting and ordering positive and negative numbers.",
        "intro": "Negative numbers are below zero. Cold temperatures, debts, sea level.",
        "questions": [
            "−3 + 5 = ?",
            "4 + (−7) = ?",
            "−2 − 6 = ?",
            "−5 − (−3) = ?",
            "Which is bigger: −2 or −5?",
            "Order: −3, 0, 4, −7, 2 (smallest first)",
            "Temperature drops from 5°C to −3°C — how many degrees?",
            "A diver at −20 m goes up 15 m. New depth?",
            "−4 × 2 = ?",
            "(−6) ÷ (−2) = ?",
        ],
    },
    {
        "id": "caps-g7-algebra-substitution",
        "grade": "Grade 7",
        "title": "Algebra — Substitution",
        "description": "Replacing letters with numbers in expressions.",
        "intro": "If x = 4, then 2x means '2 times 4' = 8.",
        "questions": [
            "If x = 5, find 2x.",
            "If x = 3, find x + 7.",
            "If a = 4, find 3a − 1.",
            "If y = 2, find y² (y squared).",
            "If x = 6 and y = 2, find x − y.",
            "If a = 3 and b = 5, find ab.",
            "If x = 10, find x/2.",
            "If n = 4, find n² + 2n.",
            "If p = 7 and q = 3, find 2p + 3q.",
            "If t = −2, find 3t.",
        ],
    },
    {
        "id": "caps-g7-solving-equations",
        "grade": "Grade 7",
        "title": "Solving Simple Equations",
        "description": "Finding the value of x in equations with one unknown.",
        "intro": "Do the same thing to both sides. Get x by itself.",
        "questions": [
            "x + 5 = 12. Find x.",
            "x − 4 = 9. Find x.",
            "2x = 14. Find x.",
            "x/3 = 5. Find x.",
            "x + 8 = 3. Find x.",
            "3x + 2 = 11. Find x.",
            "2x − 5 = 11. Find x.",
            "4(x − 2) = 12. Find x.",
            "x + 7 = 7. Find x.",
            "5 − x = 2. Find x.",
        ],
    },
    {
        "id": "caps-g7-probability-basics",
        "grade": "Grade 7",
        "title": "Probability — Simple Events",
        "description": "Likelihood of single events using fractions or decimals.",
        "intro": "Probability = (favourable outcomes) / (all possible outcomes).",
        "questions": [
            "Flip a fair coin — probability of heads?",
            "Roll a die — probability of a 6?",
            "Roll a die — probability of an even number?",
            "Roll a die — probability of getting a number bigger than 4?",
            "Bag has 3 red and 7 blue balls. P(red) = ?",
            "P(certain event) = ?",
            "P(impossible event) = ?",
            "Spinner with 4 equal colours. P(red) = ?",
            "Bag has 2 white and 8 black. P(white) as a fraction?",
            "Roll two dice — list ways to get a total of 7.",
        ],
    },
    {
        "id": "caps-g7-constructing-triangles",
        "grade": "Grade 7",
        "title": "Constructing Triangles",
        "description": "Building triangles with given sides or angles using ruler and protractor.",
        "intro": "You can build a triangle if you know: 3 sides; OR 2 sides + included angle; OR 2 angles + 1 side.",
        "questions": [
            "Can a triangle have sides 3, 4, 8 cm? Why / why not? (clue: triangle inequality)",
            "Can a triangle have sides 5, 5, 5 cm? What kind?",
            "Construct a triangle with sides 6 cm, 6 cm, 4 cm. What type?",
            "Construct: 2 sides 5 cm, angle between them = 60°. What kind?",
            "If two angles of a triangle are 30° and 90°, find the third.",
            "Triangle with angles 60°, 60°, 60° — equilateral?",
            "Why can't a triangle have sides 1, 1, 5 cm?",
            "Can you build a triangle with angles 100°, 90°, 10°? Why / why not?",
            "Construct a right-angled triangle with legs 3 cm and 4 cm. What length is the hypotenuse? (clue: Pythagoras)",
            "An equilateral triangle has perimeter 18 cm — side length?",
        ],
    },

    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 8
    # ------------------------------------------------------------------
    {
        "id": "caps-g8-expanding-factorising",
        "grade": "Grade 8",
        "title": "Expanding and Factorising",
        "description": "Brackets out (expand), brackets back in (factorise).",
        "intro": "Expand: a(b + c) = ab + ac. Factorise: find the common factor and pull it out.",
        "questions": [
            "Expand: 3(x + 4)",
            "Expand: 2(2x − 5)",
            "Expand: x(x + 3)",
            "Expand: 5(a − b + 2)",
            "Factorise: 6x + 9",
            "Factorise: 10a − 15",
            "Factorise: x² + 2x",
            "Factorise: 4y − 8",
            "Expand and simplify: 2(x + 3) + 3(x − 1)",
            "Factorise fully: 12ab + 18b",
        ],
    },
    {
        "id": "caps-g8-pythagoras",
        "grade": "Grade 8",
        "title": "Pythagoras' Theorem",
        "description": "Hypotenuse² = side² + side². In right-angled triangles only.",
        "intro": "a² + b² = c², where c is the side opposite the right angle (hypotenuse).",
        "questions": [
            "Right triangle, legs 3 and 4. Find the hypotenuse.",
            "Right triangle, legs 6 and 8. Find the hypotenuse.",
            "Right triangle, legs 5 and 12. Find the hypotenuse.",
            "Hypotenuse 13, one leg 5. Find the other leg.",
            "Hypotenuse 25, one leg 7. Find the other leg.",
            "Is a triangle with sides 5, 12, 13 right-angled? (check)",
            "Is a triangle with sides 6, 8, 10 right-angled?",
            "Ladder leans on a wall, 5 m up, base 3 m from wall. Ladder length?",
            "A square has diagonal d and side s. Express d in terms of s.",
            "Right triangle, legs 9 and 12. Find the hypotenuse.",
        ],
    },
    {
        "id": "caps-g8-linear-graphs",
        "grade": "Grade 8",
        "title": "Linear Graphs",
        "description": "y = mx + c. Gradient and y-intercept.",
        "intro": "m = gradient (slope), c = y-intercept (where the line crosses the y-axis).",
        "questions": [
            "For y = 2x + 3, find y when x = 4.",
            "For y = 2x + 3, find y when x = 0. (this is the y-intercept)",
            "For y = −x + 5, find y when x = 2.",
            "What is the gradient of y = 3x − 1?",
            "What is the y-intercept of y = 4x + 7?",
            "Does the point (2, 7) lie on y = 2x + 3?",
            "Find y when x = −1 for y = 5x − 2.",
            "Equation of a horizontal line through (0, 4)?",
            "Equation of a vertical line through (3, 0)?",
            "Line passes through (0, 1) with gradient 2 — equation?",
        ],
    },
    {
        "id": "caps-g8-volume-prisms",
        "grade": "Grade 8",
        "title": "Volume of Prisms and Cylinders",
        "description": "V = base area × height. Cuboids, triangular prisms, cylinders.",
        "intro": "Volume = the area of the cross-section × the length/height.",
        "questions": [
            "Cuboid 5 × 4 × 3 cm. Volume?",
            "Cube of side 6 cm. Volume?",
            "Triangular prism: triangle base 6 cm × height 4 cm, length 10 cm. Volume?",
            "Cylinder: radius 3 cm, height 7 cm (π ≈ 3,14). Volume?",
            "Cylinder: radius 5 cm, height 10 cm. Volume?",
            "Cube of side 10 cm. Volume in cm³?",
            "Pool 4 m × 3 m × 1,5 m deep. Volume in m³?",
            "A box holds exactly 1000 cm³. Could it be 10 × 10 × 10 cm?",
            "Convert your answer above to litres (1000 cm³ = 1 L).",
            "Cuboid 8 × 5 × 2 cm. Volume?",
        ],
    },
    {
        "id": "caps-g8-probability-trees",
        "grade": "Grade 8",
        "title": "Probability — Tree Diagrams",
        "description": "Two-step events. Independent events and their combined probabilities.",
        "intro": "Multiply probabilities along the branches.",
        "questions": [
            "Two coin flips — P(HH)?",
            "Two coin flips — P(at least one head)?",
            "Two die rolls — P(both 6s)?",
            "Coin then die — P(H and 6)?",
            "Two coin flips — list all outcomes.",
            "Bag of 5 red, 5 blue, draw with replacement: P(red, red)?",
            "Spinner 3 colours equally — P(same colour twice in a row)?",
            "Three coin flips — P(all heads)?",
            "Draw 2 cards (with replacement) from a deck — P(both red)?",
            "P(rain) = 0,3. P(no rain on two days in a row)?",
        ],
    },

    # ------------------------------------------------------------------
    # SENIOR PHASE — Grade 9
    # ------------------------------------------------------------------
    {
        "id": "caps-g9-quadratic-patterns",
        "grade": "Grade 9",
        "title": "Quadratic Patterns",
        "description": "Patterns where the second differences are constant.",
        "intro": "First differences not constant? Look at second differences.",
        "questions": [
            "Pattern: 1, 4, 9, 16. First differences? Pattern rule?",
            "Pattern: 2, 5, 10, 17. First differences? Second differences?",
            "Find the next term: 1, 4, 9, 16, ___.",
            "Find the next term: 2, 5, 10, 17, ___.",
            "Pattern n²: write the first 5 terms.",
            "Pattern n² + 1: write the first 4 terms.",
            "Find the 10th term of n²: ?",
            "If T(n) = n² − 1, find T(5).",
            "Find T(8) for T(n) = n² + n.",
            "What's the rule for 3, 8, 15, 24? (Hint: T(n) = n² + 2n)",
        ],
    },
    {
        "id": "caps-g9-equations-inequalities",
        "grade": "Grade 9",
        "title": "Linear Equations and Inequalities",
        "description": "Solving for x — including inequalities where the direction can flip.",
        "intro": "Same rules as equations. EXCEPT: when you multiply / divide by a negative, flip the inequality sign.",
        "questions": [
            "Solve: 3x + 4 = 19",
            "Solve: 5x − 7 = 18",
            "Solve: 2(x + 3) = 14",
            "Solve: 4x − 1 = 2x + 9",
            "Solve: 3(x − 2) = 2(x + 1)",
            "Solve the inequality: x + 3 < 7",
            "Solve: 2x − 1 ≥ 9",
            "Solve: −3x < 12 (careful — flip!)",
            "Solve: 5 − x > 0",
            "Solve: 2x + 5 ≤ 3x − 1",
        ],
    },
    {
        "id": "caps-g9-functions-graphs",
        "grade": "Grade 9",
        "title": "Functions and Graphs",
        "description": "y = ax² parabolas, y = ax + b lines, and what they look like.",
        "intro": "Each input x produces one output y. The set of (x, y) points is the graph.",
        "questions": [
            "Sketch y = x. What kind of line? What gradient?",
            "Sketch y = −x. What gradient?",
            "Sketch y = x². What shape?",
            "For y = x², find y when x = 3.",
            "For y = x², find y when x = −3.",
            "Where does y = x² have its lowest point?",
            "For y = 2x + 1, find y when x = 0, 1, 2.",
            "Where does y = 2x + 1 cross the y-axis?",
            "Where does y = 2x + 1 cross the x-axis?",
            "For y = −x², is the graph 'happy' (∪) or 'sad' (∩)?",
        ],
    },
    {
        "id": "caps-g9-trigonometry",
        "grade": "Grade 9",
        "title": "Trigonometry — sin, cos, tan",
        "description": "Ratios in right-angled triangles. SOH-CAH-TOA.",
        "intro": "SOH: sin = Opp/Hyp. CAH: cos = Adj/Hyp. TOA: tan = Opp/Adj.",
        "questions": [
            "What does sin stand for in SOH-CAH-TOA?",
            "What does cos stand for?",
            "What does tan stand for?",
            "Right triangle, opp = 3, hyp = 5. sin θ = ?",
            "Right triangle, adj = 4, hyp = 5. cos θ = ?",
            "Right triangle, opp = 3, adj = 4. tan θ = ?",
            "sin 30° = ? (memorise: 0,5)",
            "cos 60° = ? (memorise: 0,5)",
            "tan 45° = ?",
            "If sin θ = 0,5, what is θ?",
        ],
    },
    {
        "id": "caps-g9-surface-area-volume",
        "grade": "Grade 9",
        "title": "Surface Area and Volume",
        "description": "Outside-coverage vs inside-space. Cubes, cuboids, cylinders.",
        "intro": "Surface area = total area of all faces. Volume = how much fits inside.",
        "questions": [
            "Cube of side 4 cm. Surface area?",
            "Cube of side 4 cm. Volume?",
            "Cuboid 5 × 3 × 2 cm. Volume?",
            "Cuboid 5 × 3 × 2 cm. Surface area?",
            "Cylinder radius 3 cm, height 10 cm. Volume (π ≈ 3,14)?",
            "Cylinder radius 3 cm, height 10 cm. Total surface area?",
            "Cube with surface area 96 cm². Length of a side?",
            "Sphere of radius 5 cm. Volume (V = 4/3 π r³)?",
            "Cone radius 3 cm, height 4 cm. Volume (V = 1/3 π r² h)?",
            "Which has bigger volume: cube side 5, or sphere radius 3?",
        ],
    },
]


def build_extracted_text(ws: dict) -> str:
    """Produce the extracted_text string in the shape Echo expects."""
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
        Paragraph(f"{ws['grade']} · CAPS · CU3E", sub),
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


def wipe_existing_caps_rows(env: dict) -> int:
    """DELETE all curriculum_library rows where region='CAPS'.

    We own the CAPS content now — the old migration-006 seed and any
    re-runs are superseded by what's in WORKSHEETS. Returns the count
    of deleted rows.
    """
    base = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/curriculum_library"
    headers = {
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Prefer": "return=representation",
    }
    req = urllib.request.Request(
        f"{base}?region=eq.CAPS",
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
        "subject": "Mathematics",
        "title": ws["title"],
        "description": ws["description"],
        "storage_path": storage_path,
        "source_attribution": "CU3E CAPS Maths pack",
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
    print(f"Wiping existing CAPS rows from library...")
    wiped = wipe_existing_caps_rows(env)
    print(f"  removed {wiped} stale rows")
    print(f"Seeding {len(WORKSHEETS)} CAPS Maths worksheets (Grades 1-9)...")
    for ws in WORKSHEETS:
        storage_path = f"library/{ws['id']}.pdf"
        pdf = build_pdf(ws)
        upload_pdf(env, storage_path, pdf)
        insert_library_row(env, ws, storage_path)
        print(f"  [ok] {ws['grade']:<8} - {ws['title']} ({len(ws['questions'])} Qs)")
    print(f"\nDone. {len(WORKSHEETS)} packs in the Study Hub library across Grades 1-9.")


if __name__ == "__main__":
    main()
