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

  const prompt = `You are building a small private "memory brief" that ${childName}'s AI tutor Echo will read silently before every future conversation. Think of it as background context — what a thoughtful tutor would QUIETLY KNOW about this kid before walking into the room.

CRITICAL: this brief is OBSERVATIONS, not instructions. It tells Echo who ${childName} IS, not what to do next. Echo will use it to understand ${childName}, then let ${childName} drive the conversation fresh each time.

Write 3-6 short bullets covering (in priority order, skip categories with nothing notable):

1. Subjects + topics ${childName} has been working through (homework, curriculum, recurring threads). E.g. "Working through Grade 7 fractions — simplifying + finding GCD."

2. Specific sticking points + breakthroughs. E.g. "Got 18/24 → 9/12 → 3/4 cleanly last week. Stalls when she can't see the worksheet itself — needs problems read aloud."

3. Interests, in-jokes, recurring themes. E.g. "Curious about AI limits + ethics. Riffs creatively — invented 'speed bump' as a synonym for obstacle."

4. Style: chatty, brief, persistent, easily-distracted, etc. E.g. "Communicative but easily distracted. Goes quiet when overwhelmed."

EXPLICITLY DO NOT WRITE:
- "Ready to pick that thread back up..."
- "Last chat was about X — could resume there..."
- "Was working on Y when interrupted — circle back..."
- Anything that reads as a NEXT-STEP suggestion or call-to-action for Echo.

The reason: Echo has been opening every session by referencing yesterday's topic, which makes kids feel hounded. ${childName} should be free to open every session FRESH. The brief teaches Echo who ${childName} is; ${childName} decides what they want to work on right now.

Rules:
- Refer to ${childName} by name, never "the child" or "the kid".
- Each bullet under 22 words.
- No transcript quotes.
- Past-tense observations and present-tense traits only. NEVER future-tense "will pick up" or "is ready to" framing.
- Write it AS IF Echo wrote it for itself.
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
