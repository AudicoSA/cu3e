import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { SKILL_BY_ID } from '@/lib/skills';

export const maxDuration = 10;

type Body = {
  lessonId?: string;
  email?: string;
  note?: string;
};

// Records parent interest in a 'coming soon' AI Skills module.
// Anonymous users can submit — we just don't link to a parent_id.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const lessonId = (body.lessonId ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const note = (body.note ?? '').trim().slice(0, 500) || null;

  if (!lessonId || !SKILL_BY_ID.has(lessonId)) {
    return Response.json({ error: 'unknown lesson' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'valid email required' }, { status: 400 });
  }

  // Resolve parent_id if a session exists; otherwise leave it null.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use service-role for the insert so the operation is uniform whether the
  // submitter is logged in or anonymous. The RLS policy on skill_waitlist
  // already allows anon inserts, but service-role keeps the path identical
  // and lets us upsert cleanly on the (email, lesson_id) uniqueness key.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin
    .from('skill_waitlist')
    .upsert(
      { parent_id: user?.id ?? null, email, lesson_id: lessonId, note },
      { onConflict: 'email,lesson_id' }
    );
  if (error) {
    console.error('[skill-waitlist] upsert failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
