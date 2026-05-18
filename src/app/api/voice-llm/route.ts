import { streamText, type ModelMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 30;

// ---- Types from ElevenLabs (OpenAI Chat Completions request) ------------
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
// This is the "Custom LLM" called by ElevenLabs Conversational AI. It implements
// the OpenAI Chat Completions streaming spec so ElevenLabs treats us like
// OpenAI, but internally we look up the child + curriculum from Supabase and
// run the full Echo brain on top of GPT-4o-mini (PDF-aware).
//
// Auth: Bearer token. Same value in env (VOICE_LLM_SHARED_SECRET) and in the
// ElevenLabs agent's Custom LLM "API Key" field.
//
// Child identification: voice-session passes `child_id` + `parent_id` as
// dynamic variables. The agent's system prompt template interpolates them
// inside a `[CU3E_META]` block. We parse that block out of messages[0].
export async function POST(req: Request) {
  // Auth gate
  const expected = process.env.VOICE_LLM_SHARED_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!expected || token !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as IncomingBody;
  const incoming = body.messages ?? [];
  if (incoming.length === 0) {
    return Response.json({ error: 'no messages' }, { status: 400 });
  }

  // The first message is ElevenLabs' interpolated system prompt. Extract our
  // CU3E_META block then drop it from what we forward to OpenAI.
  const meta = parseMeta(incoming[0]?.content ?? '');
  const childId = meta.child_id;

  // Supabase service-role client — server-only, bypasses RLS so we can read
  // the child's data without a user cookie.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return Response.json({ error: 'voice-llm not configured' }, { status: 500 });
  }
  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up child + curriculum
  type Child = { id: string; first_name: string; age: number | null; grade: string | null };
  let child: Child | null = null;
  const curriculumFiles: Array<{ filename: string; data: Buffer }> = [];
  const trace: string[] = [];

  if (!childId) {
    trace.push('no-child-id');
  } else {
    const { data: childRow } = await supabase
      .from('children')
      .select('id, first_name, age, grade')
      .eq('id', childId)
      .maybeSingle();
    child = (childRow as Child) ?? null;
    if (!child) trace.push('child-not-found');
    else {
      trace.push(`child:${child.first_name}:${child.age}yo`);

      const { data: docs } = await supabase
        .from('curriculum_documents')
        .select('storage_path, filename, created_at')
        .eq('child_id', child.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (docs && docs.length > 0) {
        const seen = new Set<string>();
        for (const doc of docs as Array<{ storage_path: string; filename: string; created_at: string }>) {
          if (seen.has(doc.filename)) continue;
          seen.add(doc.filename);

          const { data: fileData, error: dlErr } = await supabase.storage
            .from('curriculum')
            .download(doc.storage_path);
          if (dlErr || !fileData) {
            trace.push(`dl-err:${doc.filename}`);
            continue;
          }
          const buffer = Buffer.from(await fileData.arrayBuffer());
          curriculumFiles.push({ filename: doc.filename, data: buffer });
          trace.push(`attached:${doc.filename}:${buffer.length}b`);
        }
      } else {
        trace.push('no-docs');
      }
    }
  }

  console.log('[voice-llm] pipeline:', trace.join(' | '));

  // Build our own system prompt (replacing ElevenLabs' interpolated one) and
  // forward the rest of the conversation history.
  const systemPrompt = buildVoiceSystemPrompt(child);

  // Forward everything except the original system message; attach PDFs to the
  // latest user turn so GPT-4o-mini can read them.
  const history: ModelMessage[] = incoming
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  if (curriculumFiles.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
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

  // Stream OpenAI completion
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: history,
    maxRetries: 1,
    temperature: body.temperature ?? 0.6,
  });

  // Translate AI SDK text stream → OpenAI Chat Completions SSE chunks.
  // ElevenLabs is reading raw SSE — it doesn't use the AI SDK on its end.
  const id = `chatcmpl-cu3e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const created = Math.floor(Date.now() / 1000);
  const modelName = body.model ?? 'gpt-4o-mini';
  const encoder = new TextEncoder();

  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // initial chunk with role
      send({
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
      });

      try {
        for await (const delta of result.textStream) {
          if (!delta) continue;
          send({
            id,
            object: 'chat.completion.chunk',
            created,
            model: modelName,
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[voice-llm] stream error:', msg);
        send({
          id,
          object: 'chat.completion.chunk',
          created,
          model: modelName,
          choices: [{ index: 0, delta: { content: ' …sorry, I lost my train of thought.' }, finish_reason: 'stop' }],
        });
      }

      send({
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      });

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
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

function buildVoiceSystemPrompt(child: { first_name: string; age: number | null; grade: string | null } | null): string {
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

  return `You are Echo, an AI tutor on CU3E. The child is talking to you with their voice — they hear you, they speak to you. This is a real conversation, not text.

ABOUT ${name.toUpperCase()}:
${voiceBand}

VOICE RULES:
- Your job is NEVER to give answers to homework. You ask the next good question instead.
- Replies are SHORT — usually one or two sentences. Voice is slow; long replies make kids drift.
- Use natural speech: "hmm", "okay", "good question", small pauses via commas.
- No formatting cues out loud — no "bullet point", no "first second third". Just talk.
- End almost every turn with a question or invitation back to ${name}.

WHEN A HOMEWORK PDF IS ATTACHED:
- You can read it directly. Refer to specific problems and rules from it.
- Never just solve problems on the page. Use them as anchors for questions.
- Reference numbers and shapes from the page out loud ("you've got 3 plus a half there, right?").
- If the PDF is image-based, describe what you see in plain words ${name} can picture.

NEVER:
- Give a straight homework answer, even when begged.
- Lecture or list facts at them.
- Talk for more than two or three sentences without pausing for ${name}.
- Pretend to be a real human — if asked, you say you're Echo, an AI tutor.

CLOSING:
If ${name} wraps up or says goodbye, give a short warm sign-off with one quick encouragement.

SUBLIMINAL AI-LITERACY WEAVING (light touch, not every turn):
When the homework topic naturally relates to how AI works — patterns, learning, mistakes, classification — drop in ONE short connection in passing. Never lecture. If there's no hook, skip it.`;
}
