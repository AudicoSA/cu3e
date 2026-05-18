import { streamText, type ModelMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const maxDuration = 60;

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
// Crucially: we open the SSE response IMMEDIATELY after the cheap auth check,
// then do DB + storage + OpenAI work INSIDE the stream. This way ElevenLabs
// sees data flowing within milliseconds and doesn't trip its cascade timeout
// while we're loading a fat PDF.
export async function POST(req: Request) {
  const expected = process.env.VOICE_LLM_SHARED_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!expected || token !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  const incoming = body.messages ?? [];
  const id = `chatcmpl-cu3e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const created = Math.floor(Date.now() / 1000);
  const modelName = body.model ?? 'gpt-4o-mini';
  const temperature = body.temperature ?? 0.6;
  const encoder = new TextEncoder();

  // Open the stream IMMEDIATELY — all heavy work happens inside start().
  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const chunk = (delta: object, finish_reason: string | null = null) => ({
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        system_fingerprint: null,
        choices: [{ index: 0, delta, finish_reason, logprobs: null }],
      });
      // Final usage chunk — OpenAI emits this when stream_options.include_usage
      // is true. ElevenLabs's accounting reads from this; without it they
      // report `model_usage: {}` and treat the response as failed.
      const usageChunk = (promptTokens: number, completionTokens: number) => ({
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        system_fingerprint: null,
        choices: [],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      });
      const finishWith = (text: string | null) => {
        if (text) send(chunk({ content: text }));
        send(chunk({}, 'stop'));
        // Best-effort estimate when we can't get real usage (early error paths)
        send(usageChunk(50, text ? Math.ceil(text.length / 4) : 1));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };

      try {
        // 1. Role chunk — first byte to keep ElevenLabs happy
        send(chunk({ role: 'assistant', content: '' }));

        if (incoming.length === 0) {
          finishWith('Hmm, I missed that — try again?');
          return;
        }

        // 2. Parse meta from system prompt
        const meta = parseMeta(incoming[0]?.content ?? '');
        const childId = meta.child_id;
        console.log('[voice-llm] start child_id:', childId);

        // 3. Heavy work: child + curriculum lookup
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!serviceKey || !supabaseUrl) {
          console.error('[voice-llm] missing supabase env');
          finishWith('Voice service is misconfigured — tell Dad.');
          return;
        }

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
          // Parallel: child row + active doc list at the same time.
          const [childRes, docsRes] = await Promise.all([
            supabase
              .from('children')
              .select('id, first_name, age, grade')
              .eq('id', childId)
              .maybeSingle(),
            supabase
              .from('curriculum_documents')
              .select('storage_path, filename, created_at')
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
              storage_path: string;
              filename: string;
              created_at: string;
            }>;

            if (docs.length === 0) {
              trace.push('no-docs');
            } else {
              // Dedupe by filename, then download in PARALLEL — saves seconds
              // when a child has multiple active PDFs.
              const seen = new Set<string>();
              const unique = docs.filter((d) => {
                if (seen.has(d.filename)) return false;
                seen.add(d.filename);
                return true;
              });

              // Download + extract text in parallel. Extracting text server-side
              // (via pdf-parse) and inlining it as text in the system prompt is
              // 5-10x faster than attaching the binary and letting OpenAI's
              // vision pipeline render every page. Image-based PDFs return
              // near-empty text and we note that in the trace.
              const downloads = await Promise.all(
                unique.map(async (doc) => {
                  try {
                    const { data: fileData, error: dlErr } = await supabase.storage
                      .from('curriculum')
                      .download(doc.storage_path);
                    if (dlErr || !fileData) return { err: doc.filename, kind: 'dl' };
                    const buffer = Buffer.from(await fileData.arrayBuffer());
                    const parsed = await pdfParse(buffer);
                    const text = (parsed.text ?? '').replace(/\s+\n/g, '\n').trim();
                    return { ok: { filename: doc.filename, text, bytes: buffer.length } };
                  } catch (e) {
                    return { err: doc.filename, kind: 'parse', msg: e instanceof Error ? e.message : String(e) };
                  }
                })
              );

              for (const d of downloads) {
                if ('err' in d) {
                  trace.push(`${d.kind}-err:${d.err}`);
                } else if (d.ok) {
                  // Cap each PDF's text at 6000 chars — keeps token cost
                  // reasonable and fits inside an ElevenLabs Custom LLM call.
                  const text = d.ok.text.length > 6000 ? d.ok.text.slice(0, 6000) + '\n…[truncated]' : d.ok.text;
                  curriculumTexts.push({ filename: d.ok.filename, text });
                  trace.push(`text:${d.ok.filename}:${text.length}c/${d.ok.bytes}b`);
                }
              }
            }
          }
        }

        console.log('[voice-llm] pipeline:', trace.join(' | '));

        // 4. Build our system prompt with inlined curriculum text + forward history
        const systemPrompt = buildVoiceSystemPrompt(child, curriculumTexts);
        const history: ModelMessage[] = incoming
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content }));

        // 5. Stream OpenAI completion.
        // maxOutputTokens caps Echo at ~2-3 sentences of voice — fast AND on-brand
        // (voice replies should be short). Cuts total response time dramatically,
        // which matters because ElevenLabs has a hard cascade timeout (~8s) on
        // how long it waits for our endpoint to finish streaming.
        const result = streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: history,
          maxRetries: 1,
          temperature,
          maxOutputTokens: 180,
        });

        for await (const delta of result.textStream) {
          if (!delta) continue;
          send(chunk({ content: delta }));
        }

        // 6. Done — send finish + usage chunks (ElevenLabs reads usage to
        // confirm the call generated tokens; missing usage = "no response").
        send(chunk({}, 'stop'));
        try {
          const usage = await result.usage;
          send(usageChunk(usage.inputTokens ?? 0, usage.outputTokens ?? 0));
        } catch {
          // Fallback if usage isn't available — better than no usage chunk at all
          send(usageChunk(50, 50));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[voice-llm] error:', msg);
        try {
          finishWith(' — sorry, something went wrong on my side.');
        } catch {
          /* stream may already be closed */
        }
      }
    },
  });

  return new Response(sseStream, {
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

  // Build curriculum block — only include PDFs with meaningful extracted text
  // (image-based PDFs return near-empty text from pdf-parse and just clutter
  // the prompt without value).
  const usableCurriculum = curriculumTexts.filter((c) => c.text && c.text.trim().length > 80);
  let curriculumBlock = '';
  if (usableCurriculum.length > 0) {
    curriculumBlock = `\n\nCURRICULUM ${name.toUpperCase()} IS WORKING ON (extracted from their uploaded PDFs):

${usableCurriculum.map((c) => `--- ${c.filename} ---\n${c.text}`).join('\n\n')}

You CAN reference specific problems, rules, examples and numbers from the curriculum above when ${name} asks about their homework. Refer to them naturally — "you've got 3/4 plus 1/2 in question 2, right?" — not by quoting verbatim.`;
  } else if (curriculumTexts.length > 0) {
    // We have PDFs but they're image-based / un-extractable
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
