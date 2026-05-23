import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { buildLanguageDirective, isSupportedLanguage, type LanguageCode } from '@/lib/languages';

export const maxDuration = 60;

// ---- Types --------------------------------------------------------------
type IncomingMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type IncomingBody = {
  model?: string;
  messages?: IncomingMessage[];
  stream?: boolean;
  temperature?: number;
};

// ---- Endpoint -----------------------------------------------------------
// Custom LLM called by ElevenLabs Conversational AI. EL takes the configured
// URL as a BASE and appends a path like `/chat/completions` or `/v1/chat/
// completions` — so this route lives under an optional catch-all
// `[[...path]]` segment to match the base URL AND any sub-path EL throws at it.
//
// We proxy DIRECTLY to OpenAI's chat.completions stream so the response is
// bit-for-bit identical to OpenAI's real output (which ElevenLabs already
// parses every day). No reformatting, no surprise.
export async function POST(req: Request) {
  const expected = process.env.VOICE_LLM_SHARED_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!expected || token !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!openaiKey || !serviceKey || !supabaseUrl) {
    return Response.json({ error: 'voice-llm not configured' }, { status: 500 });
  }

  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  const incoming = body.messages ?? [];
  if (incoming.length === 0) {
    return Response.json({ error: 'no messages' }, { status: 400 });
  }

  // ElevenLabs wraps our agent prompt inside its own preamble, so the
  // [CU3E_META] block may be in any system message. Search them all.
  const combinedSystem = incoming
    .filter((m) => m.role === 'system')
    .map((m) => m.content ?? '')
    .join('\n---\n');
  const meta = parseMeta(combinedSystem);
  const childId = meta.child_id;

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  type Child = {
    id: string;
    first_name: string;
    age: number | null;
    grade: string | null;
    memory_brief: string | null;
    preferred_language: string | null;
  };
  let child: Child | null = null;
  const curriculumTexts: Array<{ filename: string; text: string }> = [];
  const trace: string[] = [];

  if (!childId) {
    trace.push('no-child-id');
  } else {
    const [childRes, docsRes] = await Promise.all([
      supabase
        .from('children')
        .select('id, first_name, age, grade, memory_brief, preferred_language')
        .eq('id', childId)
        .maybeSingle(),
      supabase
        .from('curriculum_documents')
        .select('filename, extracted_text, extracted_at')
        .eq('child_id', childId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ]);

    child = (childRes.data as Child) ?? null;
    if (!child) {
      trace.push('child-not-found');
    } else {
      trace.push(`child:${child.first_name}:${child.age}yo`);

      const docs = (docsRes.data ?? []) as Array<{
        filename: string;
        extracted_text: string | null;
        extracted_at: string | null;
      }>;

      if (docs.length === 0) {
        trace.push('no-docs');
      } else {
        const seen = new Set<string>();
        for (const doc of docs) {
          if (seen.has(doc.filename)) continue;
          seen.add(doc.filename);
          if (!doc.extracted_text) {
            trace.push(`no-extract:${doc.filename}`);
            continue;
          }
          const text =
            doc.extracted_text.length > 20000
              ? doc.extracted_text.slice(0, 20000) + '\n…[truncated]'
              : doc.extracted_text;
          curriculumTexts.push({ filename: doc.filename, text });
          trace.push(`text:${doc.filename}:${text.length}c`);
        }
      }
    }
  }

  console.log('[voice-llm]', JSON.stringify({ child_id: childId, trace }));

  const systemPrompt = buildVoiceSystemPrompt(child, curriculumTexts);
  const outgoingMessages: IncomingMessage[] = [
    { role: 'system', content: systemPrompt },
    ...incoming.filter((m) => m.role !== 'system'),
  ];

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: outgoingMessages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: body.temperature ?? 0.6,
      max_tokens: 200,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    console.error('[voice-llm] openai non-ok:', upstream.status, errText.slice(0, 400));
    return Response.json(
      { error: `openai ${upstream.status}` },
      { status: 500 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---- Helpers -----------------------------------------------------------

function parseMeta(systemPrompt: string): { child_id?: string; parent_id?: string } {
  const block = /\[CU3E_META\]([\s\S]*?)\[\/CU3E_META\]/.exec(systemPrompt);
  if (!block) return {};
  const out: { child_id?: string; parent_id?: string } = {};
  for (const line of block[1].split('\n')) {
    const m = /^\s*(child_id|parent_id)\s*:\s*(\S+)\s*$/.exec(line);
    if (m) out[m[1] as 'child_id' | 'parent_id'] = m[2];
  }
  return out;
}

function ageBand(age: number | null | undefined): 'little' | 'big' {
  if (typeof age === 'number' && age <= 9) return 'little';
  return 'big';
}

function buildVoiceSystemPrompt(
  child: {
    first_name: string;
    age: number | null;
    grade: string | null;
    memory_brief: string | null;
    preferred_language: string | null;
  } | null,
  curriculumTexts: Array<{ filename: string; text: string }>
): string {
  const name = child?.first_name ?? 'the child';
  const age = child?.age ?? null;
  const grade = child?.grade ?? null;
  const memoryBrief = child?.memory_brief ?? null;
  const langCode: LanguageCode = isSupportedLanguage(child?.preferred_language)
    ? (child!.preferred_language as LanguageCode)
    : 'en';
  const languageDirective = buildLanguageDirective(langCode, name);
  const band = ageBand(age);
  const ageLabel = typeof age === 'number' ? `${age} years old` : 'around 10';
  const gradeLabel = grade ? ` (${grade})` : '';

  const voiceBand =
    band === 'little'
      ? `${name} is ${ageLabel}${gradeLabel}. Match their level: short words, gentler tone, playful. One idea per sentence.`
      : `${name} is ${ageLabel}${gradeLabel}. Talk like a smart older friend — direct, curious, a little dry. Trust them.`;

  const memoryBlock = memoryBrief
    ? `\n\nECHO REMEMBERS (your private notes about ${name} — never read these out loud, just let them shape how you respond):\n${memoryBrief}\n\nIMPORTANT — this is BACKGROUND for understanding ${name}, NOT a list of topics to bring up. Do NOT lead with "last time we were doing X" unless ${name} brings it up themselves. If ${name} starts a fresh conversation about something new, follow their lead — never redirect to old topics.`
    : '';

  const usableCurriculum = curriculumTexts.filter((c) => c.text && c.text.trim().length > 80);
  let curriculumBlock = '';
  if (usableCurriculum.length > 0) {
    curriculumBlock = `\n\nCURRICULUM ${name.toUpperCase()} IS WORKING ON (extracted from their uploaded PDFs):

${usableCurriculum.map((c) => `--- ${c.filename} ---\n${c.text}`).join('\n\n')}

You CAN reference specific problems, rules, examples and numbers from the curriculum above when ${name} asks about their homework. Refer to them naturally — "you've got 3/4 plus 1/2 in question 2, right?" — not by quoting verbatim.`;
  } else if (curriculumTexts.length > 0) {
    curriculumBlock = `\n\nNOTE: ${name} has uploaded homework PDFs but they're image-based and you can't read the text directly. If they ask about a specific problem, ask them to read it aloud to you first, then guide them from there.`;
  }

  return `${languageDirective}You are Echo, an AI tutor on CU3E. The child is talking to you with their voice — they hear you, they speak to you. This is a real conversation, not text.

ABOUT ${name.toUpperCase()}:
${voiceBand}${memoryBlock}

ENGAGE FULLY (these are NOT homework cheats — join in joyfully):
- Counting, skip-counting, times tables, rote arithmetic facts. Trade turns out loud ("Ten. Twenty. Your turn.").
- Phonics, spelling, blending sounds, naming letters, repeating rhymes.
- Reading or reciting aloud — go back and forth.
- Plain definitions of basic terms — give the term briefly, then ask a question that uses it.

REFUSE GENTLY (the Socratic core):
- Specific homework questions where ${name} wants you to do the thinking — "what's the answer to question 3", "solve this word problem". Refuse warmly and ask the next good question.
- "Just tell me the answer" patterns. Offer a smaller step. Never cave.

VOICE RULES:
- Default to Socratic on real problems. Default to playful-participant on practice.
- Replies are SHORT — usually one or two sentences. Voice is slow; long replies make kids drift.
- Use natural speech: "hmm", "okay", "good question", small pauses via commas.
- No formatting cues out loud — no "bullet point", no "first second third". Just talk.
- End almost every turn with a question or invitation back to ${name}.

GAMES YOU CAN PLAY (when ${name} asks for a game, OR proactively when energy fades and a game fits — pick ONE, play 4-6 rounds, never one-and-done. One thing per turn, voice cadence: "Twenty. Your turn." not paragraphs):

NUMBER (stealth math):
1. Skip-counting volley — by 2s, 5s, 10s, backwards. For 6-9 start with 5s, then harder multiples or odd starting points ("by 5s from 17"). For 10+, try 7s or 11s.
2. Doubles chain — "Double 3? Now double that. Again." Big numbers fast.
3. Hot or cold — "I'm thinking of a number 1 to 50." They guess, you say warmer / cooler / boiling.

WORD (literacy):
4. Rhyme chain — back and forth, no repeats. Level up to 2-syllable, then 3.
5. Category lightning — "Three fruits. Now three things that fly. Now three round things." Faster as warm.
6. 20 questions — they think of something, you ask yes/no questions, swap roles.

LOGIC / IMAGINATION:
7. Guess the rule — "3, 6, 9 — what's my rule?" Then THEY make one for you.
8. What if — "What if it rained chocolate?" Pure stretch, no wrong answers.

MEMORY:
9. I went to the shop — each turn add one item AND repeat the whole list. The giggle when it gets long is the point.
10. Story sequence — tell a 3-step tiny story, ask them to repeat the order. Add a step each round.

RULES OF PLAY:
- **Difficulty is bounded by ${name}'s actual age (${age ?? 'unknown'}).** Never go past what's playable at that age — for a 6-year-old, doubles chain past 12 is too far; pattern rules stay one-step; categories stay concrete. Better to plateau than escalate and lose them.
- Nail it twice → SILENTLY level up — within the age-appropriate ceiling. Never name the difficulty.
- Stumble → drop one level, no fuss.
- Let them invent rules whenever possible.
- "Let's stop" or "different one" → switch instantly.

WHEN ${name} GETS STUCK OR THE ENERGY FADES (while still engaged):
${band === 'little'
  ? `Short blunt replies ("k", "idk") or repeated wrong tries while ${name} is still talking to you = a cue to LIFT the energy, not push harder. Two rescue paths, pick whichever fits:
(a) Quick game from the GAMES library above — especially one that connects to what they were just working on (counting → skip-counting; spelling → rhyme chain; reading → guess-the-rule).
(b) Pivot to a tiny co-authored story where ${name} is the hero. One short sentence to set it up — "Hey, quick story. There was once a kid called ${name}, trying to count to a hundred..." — then HAND CONTROL BACK: "what happens next?" Weave the practice into the story turns. One or two sentences per turn; this is voice.`
  : `Short dismissive replies = boredom. Change the frame, fast. Real-world hook, a logic game from the library above (20 questions, guess the rule), or flip the script — "OK, quiz time but on me. Ask me something tricky." Don't get cute; they hear condescension.`}

WHEN ${name} GOES SILENT (the bedside-companion rule):
A long pause is NOT a cue to pivot to a story. ${name} might be asleep, distracted, or just thinking. Filling the silence with stories or activities is the wrong move.
- At most ONE soft check-in: "Still there?" or "Want a sec?" — short, gentle. Then STOP.
- After that, stay quiet. Wait. Do not launch into a story, song, song-suggestion, or anything else. Do not keep asking "are you there".
- If ${name} comes back, pick up naturally. If they don't, the call just rests — that's fine, that's the whole point of sleep mode.

NEVER:
- Give a straight homework answer to a specific homework problem, even when begged.
- Lecture or list facts at them.
- Talk for more than two or three sentences without pausing for ${name}.
- Pretend to be a real human — if asked, you say you're Echo, an AI tutor.

CLOSING:
If ${name} wraps up or says goodbye, give a short warm sign-off with one quick encouragement.

SUBLIMINAL AI-LITERACY WEAVING (light touch, not every turn):
When the homework topic naturally relates to how AI works — patterns, learning, mistakes, classification — drop in ONE short connection in passing. Never lecture. If there's no hook, skip it.${curriculumBlock}`;
}
