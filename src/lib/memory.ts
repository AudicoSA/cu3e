import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js';

// "Echo Remembers" — refreshes the running memory_brief for a child by
// summarising the last 30 days of chat_messages into 4-7 short bullets via
// Haiku. The brief gets injected into every future system prompt so Echo
// opens with real continuity.
//
// Smart-debounced: skips if no new messages have landed since the last
// refresh, plus a 5-minute cooldown to stop multi-turn thrashing. Pass
// `force: true` to override both gates. Cheap; safe to fire-and-forget from
// /api/chat onFinish, /api/voice-save, /api/voice-sync, and similar hot
// paths. Returns the new brief or an explicit { skipped: reason } shape.

export type RefreshOutcome =
  | { ok: true; brief: string }
  | { ok: true; skipped: 'cooldown' | 'no_new_messages' | 'too_few_messages'; brief: string | null }
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

  // Smart debounce:
  //   (a) 5-minute cooldown stops multi-turn thrashing inside one session.
  //   (b) Skip entirely if no chat_messages have landed since the last
  //       refresh — nothing new to summarise.
  const lastUpdatedIso = child.memory_updated_at as string | null;
  if (!args.force && lastUpdatedIso) {
    const lastUpdatedMs = new Date(lastUpdatedIso).getTime();
    const ageMs = Date.now() - lastUpdatedMs;
    if (ageMs < 5 * 60 * 1000) {
      return { ok: true, skipped: 'cooldown', brief: (child.memory_brief as string) ?? null };
    }
    const { count: newCount } = await admin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', child.id)
      .gt('created_at', lastUpdatedIso);
    if ((newCount ?? 0) === 0) {
      return { ok: true, skipped: 'no_new_messages', brief: (child.memory_brief as string) ?? null };
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

Format the brief as 4-7 short bullets, in this exact priority order:

1. FIRST bullet — the most recent conversation. What did ${childName} and Echo just talk about? Was it interrupted? Did they leave anything mid-thought? Frame it so Echo can pick up naturally next time. Example: "Last chat was about ponies — Tatum was picking names for two of them when the call cut out." Always include this bullet if there were chats today or yesterday.

2. Next bullets — what topics or subjects ${childName} is currently working through (homework, curriculum, recurring threads).

3. Anything specific they got stuck on, or had a breakthrough on.

4. Their interests, in-jokes, or recurring themes.

5. Their style: chatty, brief, persistent, easily-distracted, etc.

Rules:
- Refer to ${childName} by name, never "the child" or "the kid".
- Each bullet under 22 words.
- Skip anything generic. If nothing notable in a category, write fewer bullets.
- No quotes from the transcript.
- This is for Echo's memory only — write it AS IF Echo wrote it for itself.
- No preamble, no headings, no markdown.

CHATS (last 30 days; the most recent ones matter most):
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
