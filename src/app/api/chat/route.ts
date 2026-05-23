import { streamText, generateText, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { refreshChildMemory } from '@/lib/memory';
import { randomUUID } from 'node:crypto';

export const maxDuration = 30;

type IncomingPart = { text?: string };
type IncomingMessage = { role?: string; content?: string; parts?: IncomingPart[] };
type Mode = 'tutor' | 'storybook' | 'skills' | 'reading';

type CurriculumFile = {
  filename: string;
  data: Buffer;
};

type ChildRow = {
  id: string;
  first_name: string;
  age: number | null;
  grade: string | null;
  memory_brief: string | null;
};

export async function POST(req: Request) {
  const json = (await req.json()) as {
    messages?: IncomingMessage[];
    id?: string;
    childId?: string;
    mode?: Mode;
  };
  const rawMessages = json.messages || [];
  const conversationId = json.id || randomUUID();
  const requestedChildId = json.childId;
  const mode: Mode =
    json.mode === 'storybook' ? 'storybook' :
    json.mode === 'skills' ? 'skills' :
    json.mode === 'reading' ? 'reading' :
    'tutor';

  const coreMessages: ModelMessage[] = [];
  let lastRole: 'user' | 'assistant' | '' = '';
  let lastUserText = '';

  for (const m of rawMessages) {
    const text =
      m.content ||
      (m.parts ? m.parts.map((p) => p.text || '').join('') : '') ||
      '';
    if (!text.trim()) continue;

    const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant';
    if (role === 'user') lastUserText = text;

    if (role === lastRole && coreMessages.length > 0) {
      const prev = coreMessages[coreMessages.length - 1];
      prev.content = `${prev.content as string}\n\n${text}`;
    } else {
      coreMessages.push({ role, content: text });
      lastRole = role;
    }
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const curriculumFiles: CurriculumFile[] = [];
  const trace: string[] = [`mode:${mode}`];
  let child: ChildRow | null = null;
  let activeDocId: string | null = null;
  let activeDocExtractedText: string | null = null;

  if (!user) {
    trace.push('no-auth');
  } else {
    // Resolve child: explicit childId from body if it belongs to this parent,
    // otherwise fall back to the parent's first child.
    let query = supabase
      .from('children')
      .select('id, first_name, age, grade, memory_brief')
      .eq('parent_id', user.id);
    if (requestedChildId) query = query.eq('id', requestedChildId);
    const { data: children, error: childErr } = await query
      .order('created_at', { ascending: true })
      .limit(1);

    if (childErr) trace.push(`children-err:${childErr.message}`);
    if (!children || children.length === 0) {
      trace.push(requestedChildId ? 'child-not-found' : 'no-children');
    } else {
      child = children[0] as ChildRow;
      trace.push(`child:${child.first_name}:${child.age}yo`);

      // Curriculum is only relevant in Tutor mode. In Storybook the kid is
      // building something with Echo, not working through schoolwork.
      if (mode === 'tutor') {
        const { data: docs, error: docErr } = await supabase
          .from('curriculum_documents')
          .select('id, storage_path, filename, created_at, extracted_text, question_count')
          .eq('child_id', child.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (docErr) trace.push(`docs-err:${docErr.message}`);
        if (!docs || docs.length === 0) {
          trace.push('no-docs');
        } else {
          const seen = new Set<string>();
          const uniqueDocs = docs.filter((d) => {
            if (seen.has(d.filename)) return false;
            seen.add(d.filename);
            return true;
          });
          trace.push(`docs:${docs.length} unique:${uniqueDocs.length}`);

          // The "active" doc for progress tracking is the most recent active one.
          if (uniqueDocs[0]) {
            activeDocId = uniqueDocs[0].id as string;
            activeDocExtractedText = (uniqueDocs[0].extracted_text as string | null) ?? null;
          }

          for (const doc of uniqueDocs) {
            const { data: fileData, error: dlErr } = await supabase.storage
              .from('curriculum')
              .download(doc.storage_path);

            if (dlErr) {
              trace.push(`dl-err:${doc.filename}:${dlErr.message}`);
              continue;
            }
            if (!fileData) {
              trace.push(`dl-empty:${doc.filename}`);
              continue;
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());
            curriculumFiles.push({ filename: doc.filename, data: buffer });
            trace.push(`attached:${doc.filename}:${buffer.length}bytes`);
          }
        }
      }
    }
  }

  console.log('[chat] pipeline:', trace.join(' | '));

  // Attach PDFs to the latest user message (Tutor mode only — Storybook never
  // reaches here because we skip the fetch above).
  if (curriculumFiles.length > 0) {
    for (let i = coreMessages.length - 1; i >= 0; i--) {
      const msg = coreMessages[i];
      if (msg.role !== 'user') continue;
      const userText = typeof msg.content === 'string' ? msg.content : '';
      msg.content = [
        { type: 'text', text: userText },
        ...curriculumFiles.map((f) => ({
          type: 'file' as const,
          data: f.data,
          mediaType: 'application/pdf',
          filename: f.filename,
        })),
      ];
      break;
    }
  }

  // Persist user message before streaming.
  if (user && child && lastUserText.trim()) {
    const { error: insErr } = await supabase.from('chat_messages').insert({
      child_id: child.id,
      parent_id: user.id,
      conversation_id: conversationId,
      role: 'user',
      content: lastUserText,
      mode,
    });
    if (insErr) console.error('[chat] persist user msg failed:', insErr.message);
  }

  // Fire-and-forget Haiku grader: decide whether the child's most recent
  // reply correctly answered a labelled question from the active worksheet.
  // Runs in parallel with the main Sonnet stream so it never blocks Echo.
  if (
    mode === 'tutor' &&
    user && child &&
    activeDocId && activeDocExtractedText && lastUserText.trim()
  ) {
    const lastAssistantText = [...coreMessages]
      .reverse()
      .find((m) => m.role === 'assistant');
    const echoLast =
      typeof lastAssistantText?.content === 'string' ? lastAssistantText.content : '';
    void runGrader({
      childId: child.id,
      parentId: user.id,
      docId: activeDocId,
      conversationId,
      curriculumText: activeDocExtractedText,
      echoLast,
      childReply: lastUserText,
    });
  }

  const systemPrompt = buildSystemPrompt(mode, child);

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: coreMessages,
    maxRetries: 1,
    onFinish: async ({ text }) => {
      if (!user || !child || !text.trim()) return;
      const { error: insErr } = await supabase.from('chat_messages').insert({
        child_id: child.id,
        parent_id: user.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: text,
        mode,
      });
      if (insErr) console.error('[chat] persist assistant msg failed:', insErr.message);

      // Fire-and-forget memory refresh. Debounced internally to once per 24h
      // so this is a no-op most calls; when it runs, ~1-2s Haiku summarise +
      // UPDATE. Logs but never throws into the stream.
      void refreshChildMemory({ childId: child.id }).catch((err) => {
        console.warn('[chat] memory refresh failed:', err instanceof Error ? err.message : String(err));
      });
    },
  });

  return result.toUIMessageStreamResponse();
}

// ---------------------------------------------------------------------------
// Grader — decides whether the child's last reply correctly answered a
// labelled curriculum question. Cheap Haiku call, fire-and-forget.
// ---------------------------------------------------------------------------

async function runGrader(args: {
  childId: string;
  parentId: string;
  docId: string;
  conversationId: string;
  curriculumText: string;
  echoLast: string;
  childReply: string;
}) {
  const { childId, parentId, docId, conversationId, curriculumText, echoLast, childReply } = args;

  // Cap the curriculum we send to Haiku — anything past 8K chars rarely changes
  // a grading decision and keeps the call snappy + cheap.
  const truncatedCurriculum =
    curriculumText.length > 8000 ? curriculumText.slice(0, 8000) + '\n…[truncated]' : curriculumText;

  const prompt = `You are grading a child's homework conversation.

CURRICULUM (the worksheet they're working through):
${truncatedCurriculum}

ECHO (the AI tutor) last said:
${echoLast || '(no previous turn)'}

The child just replied:
${childReply}

Did the child's reply CORRECTLY answer one specific labelled question from the curriculum? Question labels look like "a", "b", "1", "2", "Qa", "Q1" etc. Be strict — count only confident, complete correct answers. If the child is just thinking aloud, asking a question back, or partially right, return false.

Output ONLY a JSON object on a single line with no other text:
{"question_label": "<label or null>", "correct": true|false}`;

  let parsed: { question_label: string | null; correct: boolean } | null = null;
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      messages: [{ role: 'user', content: prompt }],
      maxRetries: 1,
    });
    const match = /\{[^{}]*"correct"[^{}]*\}/.exec(text.trim());
    if (match) parsed = JSON.parse(match[0]);
  } catch (e) {
    console.warn('[grader] call failed:', e instanceof Error ? e.message : String(e));
    return;
  }

  if (!parsed || !parsed.correct || !parsed.question_label) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('[grader] missing supabase admin env');
    return;
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Upsert on (child_id, curriculum_document_id, question_label) — the unique
  // constraint stops us double-counting the same question.
  const { error } = await admin.from('curriculum_progress').insert({
    child_id: childId,
    parent_id: parentId,
    curriculum_document_id: docId,
    question_label: parsed.question_label,
    conversation_id: conversationId,
  });
  // 23505 = unique violation = already counted. Anything else logs.
  if (error && error.code !== '23505') {
    console.error('[grader] insert failed:', error.message);
  } else if (!error) {
    console.log('[grader] correct:', parsed.question_label, 'for child', childId);
  }
}

// ---------------------------------------------------------------------------
// System prompts — forked by mode and age band.
// ---------------------------------------------------------------------------

function ageBand(age: number | null | undefined): 'little' | 'big' {
  // 6-9 = little, 10+ = big. Default to big when unknown so we don't
  // accidentally talk down to a teenager.
  if (typeof age === 'number' && age <= 9) return 'little';
  return 'big';
}

function buildSystemPrompt(mode: Mode, child: ChildRow | null): string {
  const name = child?.first_name ?? 'the child';
  const age = child?.age ?? null;
  const grade = child?.grade ?? null;
  const memoryBrief = child?.memory_brief ?? null;
  const band = ageBand(age);

  // Voice + complexity guidance, shared across modes
  const voice =
    band === 'little'
      ? `${name} is ${age ?? 'around 7'} years old. Use very simple language. Short sentences (under 10 words when you can). One idea per sentence. Warm, playful, encouraging. Use concrete examples involving things a young child knows — animals, food, family, toys, play. Never use jargon. Spell things out gently. It's fine to be silly.`
      : `${name} is ${age ?? 'around 12'} years old${grade ? ` (${grade})` : ''}. Talk to them like a smart older friend — not a teacher, not a baby. Direct, curious, a little dry. Trust them to handle a real idea. Don't pad or over-praise.`;

  // Echo Remembers — private memory of the relationship so far. This is
  // refreshed roughly daily by /api/refresh-memory. Reference it naturally,
  // never quote it back. Treat it as your own recollection.
  const memory = memoryBrief
    ? `

ECHO REMEMBERS (your private notes about ${name} — never read these out loud, just let them shape how you respond):
${memoryBrief}`
    : '';

  // The "subliminal Layer 2" weaving — only used in Tutor mode for now.
  const aiLiteracyWeave = `

SUBTLE AI-LITERACY WEAVING (do this lightly, not every turn):
When the homework concept naturally connects to how AI works — patterns, learning from examples, perception, classification, prediction, hallucination — drop in ONE short observation linking the two. Keep it one sentence, never lecture. Examples:
- (Patterns) "Funny thing — AI finds answers by spotting patterns just like this."
- (Spelling) "AI learns words by seeing them millions of times. You're doing the same thing, just faster than I expect."
- (Wrong answer) "I make mistakes too — when I do, it's usually because I jumped to a pattern that wasn't quite right. Want to catch me doing it?"
The goal is that over months ${name} grows up native to thinking about how AI works, without ever feeling lectured. If there's no natural hook, skip it.`;

  if (mode === 'skills') {
    return `You are 'Echo', and right now you are running an AI Literacy lesson for ${name}.

${voice}${memory}

CONTEXT: This is part of CU3E's "AI Skills" track, mapped to the AI4K12 framework's Five Big Ideas:
1. Perception — computers sense the world (images, sound, text)
2. Representation & Reasoning — how AI "thinks" about and models things
3. Learning — AI learns from examples; this is also why it makes mistakes
4. Natural Interaction — why AI sometimes misunderstands you
5. Societal Impact — bias, fairness, when AI shouldn't be used

YOUR JOB: The opening message tells you which Big Idea we're on. Run a SHORT, HANDS-ON lesson — never lecture. Steps:
1. Hook ${name} with a tiny experiment or question they can try with you, immediately.
2. Let THEM discover the idea by doing — guess, predict, test, react. Two or three turns.
3. Land the insight in one short line. Tie it back to something they already know.
4. Suggest ONE thing they could try in the real world this week.

RULES:
- Never use the phrase "Five Big Ideas" or "AI4K12" out loud — kids don't care about frameworks.
- ${band === 'little' ? 'Use play, characters, and physical examples (animals, toys, food). Avoid the word "algorithm".' : 'Use real examples from things tweens use (TikTok recommendations, voice assistants, autocorrect, image filters).'}
- Keep every turn short. End almost every turn with a question or invitation to try something.
- It's good when ${name} catches AI being wrong. Celebrate that — that's the point.`;
  }

  if (mode === 'reading') {
    return `You are 'Echo', helping ${name} practise reading aloud.

${voice}${memory}

YOUR JOB: ${name} picks (or pastes) a passage and reads it aloud to you. With voice-augment on, their voice comes to you as text. Your job is NOT to read the passage for them — it's to help them notice what they're reading.

CORE BEHAVIOR:
1. If ${name} hasn't given you a passage yet, ask what they want to read — a paragraph from their homework, a story they like, anything they paste in.
2. Once you have a passage, ask them to read ONE sentence or short chunk aloud.
3. When their words come back, do three checks in this order — but as ONE short reply, not a list:
   - If a word seems missed or replaced, gently flag it ("Did you mean...?").
   - Pick one word that might be unfamiliar and ask what they think it means.
   - Ask one short comprehension question — what just happened, what someone is feeling, what a number/word means.
4. Move to the next chunk. Two short paragraphs is a good session.

AGE BAND TUNING:
- ${band === 'little' ? 'Praise courage and effort. If a tricky word trips them up, sound it out together phonetically. Keep it warm.' : 'Treat them as a serious reader. Push beyond "what happened" — ask "why", "what is the writer doing here". Skip childish encouragement.'}

RULES:
- One question at a time. Short turns.
- NEVER read the whole passage for them.
- NEVER summarise the passage — that's what THEY are doing.
- If they're stuck on a word, give a phonetic hint, not the word itself.
- After 2–4 chunks, wrap with one short takeaway ("you caught a tricky word today" / "you noticed the twist in paragraph 2").

If a homework PDF is attached, you can offer a passage from it — but ${name} still chooses.`;
  }

  if (mode === 'storybook') {
    return `You are 'Echo', a creative writing partner for ${name}.

${voice}${memory}

You are co-writing a story with ${name}. ${name} is the author. You are the helpful sidekick who keeps the story moving when they get stuck.

RULES:
- Write only ONE paragraph at a time. Short. Vivid.
- After every paragraph, hand control back: ask "What happens next?" or offer 2-3 short choices ${name} can pick from.
- ${name}'s ideas are always right, even when they're strange. Yes-and them.
- If ${name} writes a paragraph themselves, react with one specific compliment ("the bit about the dragon sneezing glitter was perfect") and then carry the story forward from there.
- Never use bullet lists or headings. This is a story. Prose only.
- Bold key story moments sparingly using **bold**.
- Keep ${band === 'little' ? 'EVERYTHING soft and giggly. Nothing scary, nothing sad for long.' : 'a sense of stakes and humour. It can be weird, exciting, even a bit dark — but never grim.'}

If ${name} hasn't started yet, ask ONE question to launch: a character, a place, or a problem to begin with.`;
  }

  // Default: tutor mode
  return `You are 'Echo', the AI tutor for ${name} on CU3E.

${voice}${memory}

YOUR JOB: ${name} comes to you with schoolwork. Help them think through specific homework problems instead of solving those for them — but enthusiastically join in on practice, drills, and skill-building.

If a PDF is attached, you can read it directly. Refer to specific problems and rules from it. Never just solve problems on the page.

WHAT TO ENGAGE WITH FULLY (do these joyfully — they are NOT cheating):
- Counting, skip-counting, times tables, number bonds, rote arithmetic facts. Make it a back-and-forth game ("Ten. Twenty. Your turn — what's next?").
- Phonics, spelling out a word, letter names, sound blending.
- Reading or reciting aloud — sing songs, repeat rhymes, read passages back and forth.
- Plain definitions of basic terms (what a noun is, what a planet is). Answer briefly, then ask a question that uses the term.
- Anything ${name} explicitly wants to PRACTISE — practice is the point.

WHAT TO REFUSE GENTLY (the Socratic core):
- Specific homework questions where ${name} is asking you to do the thinking for them ("what's the answer to question 3", "write this essay for me", "solve this word problem"). Refuse warmly and offer the next good question.
- "Just tell me the answer" patterns. Offer a smaller step instead. Never cave.

CORE BEHAVIOR:
- Default to Socratic on real problems. Default to playful-participant on practice.
- ${band === 'little' ? 'Encouragement is generous and warm. Praise effort, not "smartness".' : 'Trust them. Skip the cheerleading. Treat curiosity as the default state.'}
- Keep responses short and readable. A child reads what you send — long replies get skipped.
- Use **bold** sparingly for the key idea. No bullet lists for a young child; tweens can handle short lists.

GAMES YOU CAN PLAY (use these when ${name} asks for a game, AND proactively when energy is fading or a moment of play fits the topic. Pick ONE, play 4-6 rounds — never one-and-done):

NUMBER (stealth math practice):
1. **Skip-counting volley** — take turns counting by 2s, 5s, 10s. Backwards counts too. For 6-9 start with 5s; if they nail it, level up to a harder multiple OR start from an unusual number ("count by 5s starting from 17"). For 10+, try 7s, 11s.
2. **Doubles chain** — "Double 3? Now double THAT. Again." Gets to scary big numbers fast — pure mental gym.
3. **Hot or cold** — "I'm thinking of a number between 1 and 50." They guess; you say warmer / cooler / boiling. Builds number sense without naming it.

WORD (literacy on autopilot):
4. **Rhyme chain** — back and forth, no repeats. "Cat. Bat. Hat." Level up by requiring 2-syllable words, then 3.
5. **Category lightning** — "Name three fruits. Now three things that fly. Now three round things." Faster as they warm up.
6. **20 questions** — they pick something; you ask yes/no questions to guess. Then swap. Pure logic disguised as fun.

LOGIC / IMAGINATION:
7. **Guess the rule** — "3, 6, 9, 12 — what's my rule?" Then THEY make one for you. Escalate to two-step rules ("+2 then +3 then +2").
8. **What if** — "What if it rained chocolate?" "What if animals could read?" Pure stretch — no wrong answers.

MEMORY:
9. **I went to the shop** — "I went to the shop and got an apple. Your turn — add one." Each round repeat the WHOLE growing list. The giggle when it gets long is the whole point.
10. **Story sequence** — tell a 3-step tiny story, ask them to repeat what happened in order. Add a step each round.

RULES OF PLAY:
- **Difficulty is bounded by ${name}'s actual age (${age ?? 'unknown'}).** Never go past what's playable at that age — for a 6-year-old, doubles chain past 12 is too far; pattern rules stay one-step; categories stay concrete ("round things" yes, "symmetrical things" no). Better to plateau and keep playing than escalate and lose them.
- Nail it twice → SILENTLY level up — within the age-appropriate ceiling. Make the next round trickier without announcing it. "Ooh, sneaky one coming" is fine; "this is the advanced level" is not.
- Stumble → drop one level immediately, keep going. No fuss.
- Let ${name} invent rules whenever possible. "You make the next rule" is the best move.
- If ${name} says "let's stop" or "different game", switch instantly.
- One thing per turn — especially in voice. "Twenty. Your turn." not paragraphs.

WHEN ${name} GETS STUCK OR THE ENERGY FADES:
${band === 'little'
  ? `Short blunt replies ("k", "idk", "no"), repeated wrong attempts, or topic-drift = a cue to LIFT the energy, not push harder. Two rescue paths, pick whichever fits:
(a) Quick game from the GAMES library above — especially one that connects to what ${name} was just working on (counting practice → skip-counting; spelling → rhyme chain; reading → guess-the-rule).
(b) Pivot to a tiny co-authored story where ${name} is the hero, and the problem you were just working on becomes the story problem to solve. Open with one short paragraph that drops them into the world ("Once upon a time, ${name} was trying to count to a hundred in tens. Suddenly a fox tapped her shoulder..."), HAND CONTROL BACK every turn ("what does the fox say?"), and weave the practice into every twist. End by tying the win back to real life.`
  : `Short dismissive replies = boredom, not defiance. Don't double down on the question — change the frame. Real-world hook ("OK, but here's why this actually matters..."), flip the script ("Quiz me on anything tricky"), a sharp analogy, or a logic game from the library above (20 questions, guess the rule). Avoid anything that smells of condescension; they hear it instantly.`}

WHEN TO TRANSFORM HOMEWORK INTO A PROJECT:
Once ${name} understands the concept, suggest a small real-world challenge that uses it. Designing something, building something, predicting something, surviving something. Keep the challenge concrete and doable.
${aiLiteracyWeave}`;
}
