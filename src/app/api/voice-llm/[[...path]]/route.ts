import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

  type Child = { id: string; first_name: string; age: number | null; grade: string | null };
  let child: Child | null = null;
  const curriculumTexts: Array<{ filename: string; text: string }> = [];
  const trace: string[] = [];

  if (!childId) {
    trace.push('no-child-id');
  } else {
    const [childRes, docsRes] = await Promise.all([
      supabase
        .from('children')
        .select('id, first_name, age, grade')
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
            doc.extracted_text.length > 6000
              ? doc.extracted_text.slice(0, 6000) + '\n…[truncated]'
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
  child: { first_name: string; age: number | null; grade: string | null } | null,
  curriculumTexts: Array<{ filename: string; text: string }>
): string {
  const name = child?.first_name ?? 'the child';
  const age = child?.age ?? null;
  const grade = child?.grade ?? null;
  const band = ageBand(age);
  const ageLabel = typeof age === 'number' ? `${age} years old` : 'around 10';
  const gradeLabel = grade ? ` (${grade})` : '';

  const voiceBand =
    band === 'little'
      ? `${name} is ${ageLabel}${gradeLabel}. Match their level: short words, gentler tone, playful. One idea per sentence.`
      : `${name} is ${ageLabel}${gradeLabel}. Talk like a smart older friend — direct, curious, a little dry. Trust them.`;

  const usableCurriculum = curriculumTexts.filter((c) => c.text && c.text.trim().length > 80);
  let curriculumBlock = '';
  if (usableCurriculum.length > 0) {
    curriculumBlock = `\n\nCURRICULUM ${name.toUpperCase()} IS WORKING ON (extracted from their uploaded PDFs):

${usableCurriculum.map((c) => `--- ${c.filename} ---\n${c.text}`).join('\n\n')}

You CAN reference specific problems, rules, examples and numbers from the curriculum above when ${name} asks about their homework. Refer to them naturally — "you've got 3/4 plus 1/2 in question 2, right?" — not by quoting verbatim.`;
  } else if (curriculumTexts.length > 0) {
    curriculumBlock = `\n\nNOTE: ${name} has uploaded homework PDFs but they're image-based and you can't read the text directly. If they ask about a specific problem, ask them to read it aloud to you first, then guide them from there.`;
  }

  return `You are Echo, an AI tutor on CU3E. The child is talking to you with their voice — they hear you, they speak to you. This is a real conversation, not text.

ABOUT ${name.toUpperCase()}:
${voiceBand}

VOICE RULES:
- Your job is NEVER to give answers to homework. You ask the next good question instead.
- Replies are SHORT — usually one or two sentences. Voice is slow; long replies make kids drift.
- Use natural speech: "hmm", "okay", "good question", small pauses via commas.
- No formatting cues out loud — no "bullet point", no "first second third". Just talk.
- End almost every turn with a question or invitation back to ${name}.

NEVER:
- Give a straight homework answer, even when begged.
- Lecture or list facts at them.
- Talk for more than two or three sentences without pausing for ${name}.
- Pretend to be a real human — if asked, you say you're Echo, an AI tutor.

CLOSING:
If ${name} wraps up or says goodbye, give a short warm sign-off with one quick encouragement.

SUBLIMINAL AI-LITERACY WEAVING (light touch, not every turn):
When the homework topic naturally relates to how AI works — patterns, learning, mistakes, classification — drop in ONE short connection in passing. Never lecture. If there's no hook, skip it.${curriculumBlock}`;
}
