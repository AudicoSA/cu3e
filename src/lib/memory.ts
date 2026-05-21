import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js';

// "Echo Remembers" — refreshes the running memory_brief for a child by
// summarising the last 30 days of chat_messages into 4-7 short bullets via
// Haiku. The brief gets injected into every future system prompt so Echo
// opens with real continuity.
//
// Debounced internally — won't re-summarise within 24h unless `force: true`.
// Cheap; safe to fire-and-forget from /api/chat onFinish and similar hot
// paths. Returns the new brief or an explicit { skipped: reason } shape.

export type RefreshOutcome =
  | { ok: true; brief: string }
  | { ok: true; skipped: 'recent' | 'too_few_messages'; brief: string | null }
  | { ok: false; error: string };

export async function refreshChildMemory(args: {
  childId: string;
  force?: boolean;
}): Promise<RefreshOutcome> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'supabase admin env missing' };
  }
  const admin: SupabaseClient = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: child } = await admin
    .from('children')
    .select('id, first_name, memory_brief, memory_updated_at')
    .eq('id', args.childId)
    .maybeSingle();
  if (!child) return { ok: false, error: 'child not found' };

  // Debounce — once a day is enough. Pass `force: true` to override.
  if (!args.force && child.memory_updated_at) {
    const ageMs = Date.now() - new Date(child.memory_updated_at as string).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return { ok: true, skipped: 'recent', brief: (child.memory_brief as string) ?? null };
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from('chat_messages')
    .select('role, content, mode, flagged')
    .eq('child_id', child.id)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  if (!rows || rows.length < 4) {
    return {
      ok: true,
      skipped: 'too_few_messages',
      brief: (child.memory_brief as string) ?? null,
    };
  }

  const childName = child.first_name as string;
  const transcript = (rows as Array<{ role: string; content: string; mode: string | null; flagged: boolean | null }>)
    .map((r) => {
      const who = r.role === 'user' ? childName : 'Echo';
      const tag = r.mode && r.mode !== 'tutor' ? ` [${r.mode}]` : '';
      const flag = r.flagged ? ' [flagged]' : '';
      return `${who}${tag}${flag}: ${String(r.content).replace(/\s+/g, ' ').slice(0, 240)}`;
    })
    .join('\n');

  const prompt = `You are building a small private "memory brief" that ${childName}'s AI tutor Echo will read at the start of every future conversation. Think of it as: what would a good tutor remember about this kid?

Capture, in 4-7 short bullet points (no preamble, no headings, no markdown):
- What topics or subjects ${childName} is currently working through
- Anything specific they got stuck on, or had a breakthrough on
- Their interests, in-jokes, or recurring themes (if any emerged)
- Their style: chatty, brief, persistent, easily-distracted, etc.
- Anything about their tone or temperament Echo should remember

Rules:
- Refer to ${childName} by name, never "the child" or "the kid".
- Each bullet under 18 words.
- Skip anything generic. If nothing notable, write fewer bullets.
- No quotes from the transcript.
- This is for Echo's memory only — write it AS IF Echo wrote it for itself.

CHATS (last 30 days):
${transcript.slice(0, 24000)}

Output the bullets only, one per line, starting with "- ".`;

  let brief = '';
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      messages: [{ role: 'user', content: prompt }],
      maxRetries: 1,
    });
    brief = (text ?? '').trim();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!brief) return { ok: false, error: 'empty summary' };

  const { error: updErr } = await admin
    .from('children')
    .update({ memory_brief: brief, memory_updated_at: new Date().toISOString() })
    .eq('id', child.id);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, brief };
}
