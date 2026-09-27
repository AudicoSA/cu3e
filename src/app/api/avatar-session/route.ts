import { createClient } from '@/utils/supabase/server';
import { buildVoiceSystemPrompt } from '@/lib/echo-voice-prompt';
import { isSupportedLanguage } from '@/lib/languages';
import { signLiveTicket } from '@/lib/live-ticket';

export const maxDuration = 30;

type Body = { childId?: string; mode?: string };

// Cap on curriculum text folded into the Live system prompt. The relay ships
// the whole prompt in the ticket, and every Gemini turn re-reads context, so
// keep this well under the 128k-token window.
const MAX_CURRICULUM_CHARS = 60_000;

// Starts a face-to-face (Gemini Live Avatar) session.
//
// Mirrors /api/voice-session: auth + child ownership, then builds Echo's
// spoken-tutor prompt (shared with the ElevenLabs path via
// lib/echo-voice-prompt) and signs it into a short-lived ticket that the
// browser hands to the live relay. Google credentials never reach the browser.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const relayUrl = process.env.NEXT_PUBLIC_LIVE_RELAY_URL;
  const secret = process.env.LIVE_RELAY_SECRET;
  if (!relayUrl || !secret) {
    return Response.json(
      { error: 'face-to-face not configured (NEXT_PUBLIC_LIVE_RELAY_URL / LIVE_RELAY_SECRET)' },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.childId) return Response.json({ error: 'childId required' }, { status: 400 });

  const [childRes, docsRes] = await Promise.all([
    supabase
      .from('children')
      .select('id, first_name, age, grade, memory_brief, preferred_language')
      .eq('id', body.childId)
      .eq('parent_id', user.id)
      .maybeSingle(),
    supabase
      .from('curriculum_documents')
      .select('filename, extracted_text')
      .eq('child_id', body.childId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ]);

  const child = childRes.data as {
    id: string;
    first_name: string;
    age: number | null;
    grade: string | null;
    memory_brief: string | null;
    preferred_language: string | null;
  } | null;
  if (!child) return Response.json({ error: 'child not found' }, { status: 404 });

  // Same de-dupe + truncation as voice-llm, plus an overall budget.
  const curriculum: Array<{ filename: string; text: string }> = [];
  const seen = new Set<string>();
  let budget = MAX_CURRICULUM_CHARS;
  for (const doc of (docsRes.data ?? []) as Array<{ filename: string; extracted_text: string | null }>) {
    if (seen.has(doc.filename) || budget <= 0) continue;
    seen.add(doc.filename);
    const raw = doc.extracted_text ?? '';
    const cap = Math.min(20_000, budget);
    const text = raw.length > cap ? raw.slice(0, cap) + '\n…[truncated]' : raw;
    budget -= text.length;
    curriculum.push({ filename: doc.filename, text });
  }

  const prompt = buildVoiceSystemPrompt(child, curriculum, { avatar: true });
  const lang = isSupportedLanguage(child.preferred_language) ? child.preferred_language : 'en';
  const maxMinutes = Number(process.env.AVATAR_MAX_SESSION_MINUTES || 15);

  const ticket = signLiveTicket(
    {
      childId: child.id,
      parentId: user.id,
      childName: child.first_name,
      lang,
      mode: body.mode ?? 'tutor',
      prompt,
      maxMinutes,
      exp: Date.now() + 60_000,
    },
    secret
  );

  console.log(
    '[avatar-session]',
    JSON.stringify({ child: child.first_name, lang, promptChars: prompt.length, docs: curriculum.length })
  );

  return Response.json({ relayUrl, ticket, maxMinutes });
}
