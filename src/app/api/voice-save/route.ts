import { createServerClient, type CookieMethodsServerDeprecated } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

export const maxDuration = 30;

type VoiceTurn = {
  role: 'user' | 'assistant';
  content: string;
};

type Body = {
  childId?: string;
  conversationId?: string;
  turns?: VoiceTurn[];
};

// Persists a completed voice conversation as chat_messages rows with mode='voice'.
// Called by the client when a voice session ends.
export async function POST(req: Request) {
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
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const turns = body.turns ?? [];
  const childId = body.childId;
  const conversationId = body.conversationId || randomUUID();

  if (!childId) {
    return Response.json({ error: 'childId required' }, { status: 400 });
  }
  if (turns.length === 0) {
    // Empty conversation (kid opened then immediately closed). Don't insert.
    return Response.json({ inserted: 0 });
  }

  // Verify the child belongs to this parent (defence in depth — RLS will also enforce)
  const { data: childRow } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', user.id)
    .maybeSingle();
  if (!childRow) {
    return Response.json({ error: 'child_not_found' }, { status: 404 });
  }

  // Build inserts — strip empty turns, cap content length defensively.
  const rows = turns
    .filter((t) => t.content && t.content.trim().length > 0)
    .map((t) => ({
      child_id: childId,
      parent_id: user.id,
      conversation_id: conversationId,
      role: t.role === 'user' ? 'user' : 'assistant',
      content: t.content.slice(0, 4000),
      mode: 'voice' as const,
    }));

  if (rows.length === 0) {
    return Response.json({ inserted: 0 });
  }

  const { error: insErr } = await supabase.from('chat_messages').insert(rows);
  if (insErr) {
    console.error('[voice-save] insert failed:', insErr.message);
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({ inserted: rows.length, conversationId });
}
