import { createClient } from '@/utils/supabase/server';
import { refreshChildMemory } from '@/lib/memory';

export const maxDuration = 30;

type Body = {
  childId?: string;
  // Force a refresh even if memory_updated_at is recent. Useful for a
  // dashboard "refresh memory" button; main path is debounced (~daily).
  force?: boolean;
};

// User-facing wrapper around lib/memory.refreshChildMemory. Enforces that
// the requesting parent owns the child; the lib itself does no auth.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const childId = body.childId;
  if (!childId) {
    return Response.json({ error: 'childId required' }, { status: 400 });
  }

  // Ownership check before letting the lib use service-role to read/write.
  const { data: owned } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', user.id)
    .maybeSingle();
  if (!owned) {
    return Response.json({ error: 'child not found' }, { status: 404 });
  }

  const result = await refreshChildMemory({ childId, force: body.force === true });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json(result);
}
