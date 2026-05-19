import { createHmac } from 'node:crypto';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const maxDuration = 60;

// Pulls voice transcripts directly from the ElevenLabs Conversational AI API
// and persists them as chat_messages rows with mode='voice'. Used instead of
// the EL post-call webhook (which has been finicky to attach in their UI).
//
// Auth: either
//   - Bearer header matching VOICE_LLM_SHARED_SECRET (for manual / scripted runs)
//   - x-vercel-cron header (set by Vercel cron jobs; routes guarded by it
//     are automatically restricted to Vercel's IP space)
//
// Idempotent: deterministic conversation_id derived from the EL conversation
// id, then short-circuits if any row already exists for that conversation_id.
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const expected = process.env.VOICE_LLM_SHARED_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const cronHeader = req.headers.get('x-vercel-cron');
  const authorized = !!cronHeader || (expected && token === expected);
  if (!authorized) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const elKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!elKey || !agentId || !supabaseUrl || !serviceKey) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }

  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Optional query params:
  //   ?since=<unix>     — only fetch convs that started after this timestamp
  //   ?max=<n>          — cap total convs pulled (default 100)
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const maxParam = url.searchParams.get('max');
  const startAfterUnix = sinceParam ? Number(sinceParam) : undefined;
  const maxConvs = maxParam ? Math.max(1, Math.min(500, Number(maxParam))) : 100;

  // 1. Page through EL conversations for our agent.
  const convIds: string[] = [];
  let cursor: string | undefined;
  while (convIds.length < maxConvs) {
    const params = new URLSearchParams({
      agent_id: agentId,
      page_size: String(Math.min(100, maxConvs - convIds.length)),
    });
    if (cursor) params.set('cursor', cursor);
    if (startAfterUnix) params.set('call_start_after_unix', String(startAfterUnix));

    const listRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations?${params.toString()}`,
      { headers: { 'xi-api-key': elKey } }
    );
    if (!listRes.ok) {
      const errText = await listRes.text().catch(() => '');
      return Response.json(
        { error: `el list failed ${listRes.status}: ${errText.slice(0, 300)}` },
        { status: 500 }
      );
    }
    const listJson = (await listRes.json()) as {
      conversations?: Array<{ conversation_id: string; status: string }>;
      next_cursor?: string | null;
      has_more?: boolean;
    };
    const convs = listJson.conversations ?? [];
    for (const c of convs) {
      if (c.status === 'done') convIds.push(c.conversation_id);
    }
    if (!listJson.has_more || !listJson.next_cursor) break;
    cursor = listJson.next_cursor;
  }

  // 2. For each conv, dedupe against existing rows, then fetch full transcript
  //    and insert.
  const results = {
    scanned: convIds.length,
    skipped_already_persisted: 0,
    skipped_no_meta: 0,
    skipped_empty: 0,
    persisted_conversations: 0,
    persisted_messages: 0,
    errors: [] as string[],
  };

  for (const elConvId of convIds) {
    const dbConvId = elConversationToUuid(elConvId);

    // Skip if already persisted
    const { data: existing } = await admin
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', dbConvId)
      .eq('mode', 'voice')
      .limit(1);
    if (existing && existing.length > 0) {
      results.skipped_already_persisted += 1;
      continue;
    }

    // Fetch full conversation
    const detailRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${elConvId}`,
      { headers: { 'xi-api-key': elKey } }
    );
    if (!detailRes.ok) {
      results.errors.push(`get ${elConvId}: ${detailRes.status}`);
      continue;
    }
    const detail = (await detailRes.json()) as ConversationDetail;

    const dyn = detail.conversation_initiation_client_data?.dynamic_variables ?? {};
    const childId = typeof dyn.child_id === 'string' ? dyn.child_id : null;
    const parentId = typeof dyn.parent_id === 'string' ? dyn.parent_id : null;
    if (!childId || !parentId) {
      results.skipped_no_meta += 1;
      continue;
    }

    const baseStart = (detail.metadata?.start_time_unix_secs ?? 0) * 1000;
    const turns = (detail.transcript ?? []).filter(
      (t) => t && typeof t.message === 'string' && t.message.trim() !== ''
    );
    if (turns.length === 0) {
      results.skipped_empty += 1;
      continue;
    }

    const rows = turns.map((t) => ({
      child_id: childId,
      parent_id: parentId,
      conversation_id: dbConvId,
      role: t.role === 'agent' ? 'assistant' : 'user',
      content: t.message as string,
      mode: 'voice' as const,
      created_at: baseStart
        ? new Date(baseStart + (t.time_in_call_secs ?? 0) * 1000).toISOString()
        : new Date().toISOString(),
    }));

    const { error } = await admin.from('chat_messages').insert(rows);
    if (error) {
      results.errors.push(`insert ${elConvId}: ${error.message}`);
      continue;
    }
    results.persisted_conversations += 1;
    results.persisted_messages += rows.length;
  }

  return Response.json({ ok: true, ...results });
}

// ---------------------------------------------------------------------------
// Same uuid derivation as /api/voice-webhook so retries / future webhook
// fires never duplicate. SHA-256 of EL id, first 16 bytes formatted as uuid.
// ---------------------------------------------------------------------------
function elConversationToUuid(elId: string): string {
  const h = createHmac('sha256', 'cu3e-voice').update(elId).digest();
  const b = h.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

type ConversationDetail = {
  conversation_id: string;
  status?: string;
  transcript?: Array<{
    role?: string;
    message?: string;
    time_in_call_secs?: number;
  }>;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, unknown>;
  };
};
