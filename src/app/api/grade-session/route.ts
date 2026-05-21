import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const maxDuration = 30;

type Body = { conversationId?: string };

const GradeSchema = z.object({
  persistence: z.number().int().min(1).max(5).describe('How much did the child stick with the problem instead of demanding the answer? 1 = gave up / begged for answer, 3 = mid, 5 = fully engaged thinking.'),
  insight: z.number().int().min(1).max(5).describe('Did real thinking happen? 1 = passive, 3 = guided thinking, 5 = original or curious questions.'),
  breakthrough: z.number().int().min(1).max(5).describe('Was there an aha moment? 1 = none, 3 = small step forward, 5 = clear breakthrough.'),
  summary: z.string().max(160).describe('One-line takeaway in parent voice (e.g. "Worked through patterns; got stuck on rule but caught it on her own"). Past tense.'),
});

// Grades a conversation that has just ended. Pulls all messages with the given
// conversation_id, asks Claude Haiku to score on three dimensions (cheap +
// fast — this is heuristic-grade signal, not a research instrument).
//
// One grade per conversation_id (enforced by unique constraint). If a grade
// already exists, returns the existing one.
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const conversationId = body.conversationId;
  if (!conversationId) {
    return Response.json({ error: 'conversationId required' }, { status: 400 });
  }

  // Existing grade?
  const { data: existing } = await supabase
    .from('session_grades')
    .select('id, persistence, insight, breakthrough, summary')
    .eq('conversation_id', conversationId)
    .eq('parent_id', user.id)
    .maybeSingle();
  if (existing) {
    return Response.json({ existing: true, grade: existing });
  }

  // Pull the conversation messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('child_id, role, content, mode, created_at')
    .eq('conversation_id', conversationId)
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true });

  const rows = (messages ?? []) as Array<{
    child_id: string;
    role: string;
    content: string;
    mode: string;
    created_at: string;
  }>;
  if (rows.length < 2) {
    // Too short to grade — likely 1-shot or empty
    return Response.json({ skipped: 'too_short', count: rows.length });
  }

  const childId = rows[0].child_id;
  const mode = rows[0].mode;

  // Build a compact transcript for grading
  const transcript = rows
    .map((r) => {
      const speaker = r.role === 'user' ? 'KID' : 'ECHO';
      const text = r.content.replace(/\s+/g, ' ').slice(0, 500);
      return `${speaker}: ${text}`;
    })
    .join('\n');

  const system = `You are a learning-quality grader for an AI-tutor product (CU3E). You see a transcript of a child talking to an AI tutor named Echo.

Score on three 1-5 dimensions:
- persistence: did the child stick with the problem instead of demanding the answer? 1 = gave up or begged for answer, 5 = fully engaged in thinking through it.
- insight: did real thinking happen on the child's side? 1 = passive replies, 5 = original questions, connections, curiosity.
- breakthrough: was there an aha moment in the conversation? 1 = none, 5 = clear breakthrough or new understanding.

Also write a one-line parent-voice summary (max 160 chars), past tense. Examples:
- "Worked through patterns homework, found the rule on her own."
- "Started a dragon story; abandoned it halfway when distracted."
- "Argued with Echo about a wrong AI label — caught the mistake."

Be honest. If a session was lazy, score low. If it was great, score high. Most sessions are 3s.`;

  const result = await generateObject({
    model: anthropic('claude-haiku-4-5'),
    schema: GradeSchema,
    system,
    prompt: `MODE: ${mode}\n\nTRANSCRIPT:\n${transcript}`,
    maxRetries: 1,
  });

  const grade = result.object;

  const { error: insErr, data: inserted } = await supabase
    .from('session_grades')
    .insert({
      conversation_id: conversationId,
      child_id: childId,
      parent_id: user.id,
      mode,
      persistence: grade.persistence,
      insight: grade.insight,
      breakthrough: grade.breakthrough,
      summary: grade.summary,
      message_count: rows.length,
    })
    .select('id, persistence, insight, breakthrough, summary')
    .single();

  if (insErr) {
    // Race: another caller already graded this conversation. Re-fetch and return.
    if (insErr.code === '23505') {
      const { data: existing2 } = await supabase
        .from('session_grades')
        .select('id, persistence, insight, breakthrough, summary')
        .eq('conversation_id', conversationId)
        .eq('parent_id', user.id)
        .maybeSingle();
      if (existing2) {
        return Response.json({ existing: true, grade: existing2 });
      }
    }
    console.error('[grade-session] insert failed:', insErr.message);
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  // Breakthrough push: if this session was strong (breakthrough >= 4 OR
  // composite >= 4), create a parent_notification so the dashboard surfaces
  // it. Uniqueness on (source_grade_id) stops duplicates if grading is ever
  // re-run for the same conversation.
  void maybeCreateBreakthroughNotification({
    gradeId: inserted!.id as string,
    childId,
    parentId: user.id,
    persistence: grade.persistence,
    insight: grade.insight,
    breakthrough: grade.breakthrough,
    summary: grade.summary,
  }).catch((err) =>
    console.warn('[grade-session] breakthrough notify failed:', err instanceof Error ? err.message : String(err))
  );

  return Response.json({ existing: false, grade: inserted });
}

async function maybeCreateBreakthroughNotification(args: {
  gradeId: string;
  childId: string;
  parentId: string;
  persistence: number;
  insight: number;
  breakthrough: number;
  summary: string;
}) {
  const composite = (args.persistence + args.insight + args.breakthrough) / 3;
  // Two-track trigger: a strong breakthrough on its own, OR a strong overall
  // session even without a single big aha. Tuned conservatively so parents
  // only get notified for sessions actually worth a high-five.
  const trigger = args.breakthrough >= 4 || composite >= 4.3;
  if (!trigger) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: child } = await admin
    .from('children')
    .select('first_name')
    .eq('id', args.childId)
    .maybeSingle();
  const name = (child?.first_name as string) ?? 'Your child';

  const title =
    args.breakthrough >= 4
      ? `${name} just had a breakthrough`
      : `Strong session from ${name}`;

  const { error } = await admin
    .from('parent_notifications')
    .insert({
      parent_id: args.parentId,
      child_id: args.childId,
      kind: 'breakthrough',
      title,
      body: args.summary,
      source_grade_id: args.gradeId,
    });
  // 23505 = unique violation on source_grade_id (already notified). Ignore.
  if (error && error.code !== '23505') {
    console.warn('[grade-session] notification insert failed:', error.message);
  }
}
