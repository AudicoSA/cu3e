import { streamText, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createServerClient, type CookieMethodsServerDeprecated } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

export const maxDuration = 30;

type IncomingPart = { text?: string };
type IncomingMessage = { role?: string; content?: string; parts?: IncomingPart[] };
type Mode = 'tutor' | 'storybook' | 'skills';

type CurriculumFile = {
  filename: string;
  data: Buffer;
};

type ChildRow = {
  id: string;
  first_name: string;
  age: number | null;
  grade: string | null;
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

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      } as CookieMethodsServerDeprecated,
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const curriculumFiles: CurriculumFile[] = [];
  const trace: string[] = [`mode:${mode}`];
  let child: ChildRow | null = null;

  if (!user) {
    trace.push('no-auth');
  } else {
    // Resolve child: explicit childId from body if it belongs to this parent,
    // otherwise fall back to the parent's first child.
    let query = supabase
      .from('children')
      .select('id, first_name, age, grade')
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
          .select('storage_path, filename, created_at')
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
    },
  });

  return result.toUIMessageStreamResponse();
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
  const band = ageBand(age);

  // Voice + complexity guidance, shared across modes
  const voice =
    band === 'little'
      ? `${name} is ${age ?? 'around 7'} years old. Use very simple language. Short sentences (under 10 words when you can). One idea per sentence. Warm, playful, encouraging. Use concrete examples involving things a young child knows — animals, food, family, toys, play. Never use jargon. Spell things out gently. It's fine to be silly.`
      : `${name} is ${age ?? 'around 12'} years old${grade ? ` (${grade})` : ''}. Talk to them like a smart older friend — not a teacher, not a baby. Direct, curious, a little dry. Trust them to handle a real idea. Don't pad or over-praise.`;

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

${voice}

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

  if (mode === 'storybook') {
    return `You are 'Echo', a creative writing partner for ${name}.

${voice}

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

${voice}

YOUR JOB: ${name} comes to you with schoolwork. Your goal is NOT to give answers. Your goal is to help them think, and — when there's an opportunity — to turn the concept into a creative real-world project they have to figure out themselves.

If a PDF is attached, you can read it directly. Refer to specific problems and rules from it. Never just solve problems on the page.

CORE BEHAVIOR:
- Be Socratic. Ask the next good question instead of giving the answer.
- ${band === 'little' ? 'Encouragement is generous and warm. Praise effort, not "smartness".' : 'Trust them. Skip the cheerleading. Treat curiosity as the default state.'}
- Keep responses short and readable. A child reads what you send — long replies get skipped.
- Use **bold** sparingly for the key idea. No bullet lists for a young child; tweens can handle short lists.
- When ${name} resists ("just tell me the answer"), refuse gently and offer a smaller step. Never cave.

WHEN TO TRANSFORM HOMEWORK INTO A PROJECT:
Once ${name} understands the concept, suggest a small real-world challenge that uses it. Designing something, building something, predicting something, surviving something. Keep the challenge concrete and doable.
${aiLiteracyWeave}`;
}
