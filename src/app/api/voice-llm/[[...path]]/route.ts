import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { buildVoiceSystemPrompt } from '@/lib/echo-voice-prompt';

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

  // PHANTOM-SILENCE FILTER. ElevenLabs sometimes forwards a turn whose user
  // content is just "..." or empty — typically because its VAD/transcriber
  // produced no actual words but EL still wanted a turn. The system prompt
  // tells Echo to stay quiet during silence, but EL keeps inviting a response,
  // so Echo ends up firing "still there?" every couple of seconds.
  //
  // Skip the LLM call entirely on those turns and return an empty SSE stream
  // in OpenAI's exact format so EL accepts the response and just stays
  // quiet. Echo says nothing; the kid keeps thinking.
  const lastUserMsg = [...incoming].reverse().find((m) => m.role === 'user');
  const isPhantomSilence = (() => {
    if (!lastUserMsg) return false;
    const raw = (lastUserMsg.content ?? '').trim();
    if (!raw) return true;
    // Strip dots, ellipses, whitespace, common silence placeholders.
    const stripped = raw.replace(/[.…\s]/g, '');
    return stripped.length === 0;
  })();

  console.log('[voice-llm]', JSON.stringify({ child_id: childId, trace, phantom_silence: isPhantomSilence }));

  if (isPhantomSilence) {
    const empty =
      `data: {"id":"silent","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n` +
      `data: {"id":"silent","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n` +
      `data: [DONE]\n\n`;
    return new Response(empty, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

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
