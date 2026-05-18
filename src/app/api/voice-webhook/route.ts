import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const maxDuration = 30;

// Post-call webhook from ElevenLabs Conversational AI. When a voice session
// ends, EL POSTs the full transcript + metadata here. We:
//   1. Verify the HMAC signature using ELEVENLABS_WEBHOOK_SECRET
//   2. Extract child_id + parent_id from the conversation's dynamic_variables
//      (we set these in /api/voice-session before the call starts)
//   3. Insert every transcript turn into chat_messages with mode='voice'
//
// Idempotency: if EL retries, we'd double-insert. We use the conversation_id
// as conversation_id on each row + a deterministic offset to dedupe per turn.
// Cheaper: just check if rows already exist for this conversation_id and bail
// if they do.
export async function POST(req: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[voice-webhook] missing ELEVENLABS_WEBHOOK_SECRET');
    return Response.json({ error: 'not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('elevenlabs-signature') ?? '';

  if (!verifySignature(rawBody, sigHeader, secret)) {
    console.warn('[voice-webhook] bad signature; header=', sigHeader.slice(0, 60));
    return Response.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  if (payload?.type !== 'post_call_transcription') {
    // Audio webhooks and call_initiation_failure share the endpoint by default;
    // ignore anything that isn't a transcript event.
    return Response.json({ ok: true, skipped: payload?.type ?? 'unknown' });
  }

  const data = payload.data;
  if (!data) {
    return Response.json({ error: 'no data' }, { status: 400 });
  }

  const dynamicVars =
    data.conversation_initiation_client_data?.dynamic_variables ?? {};
  const childId =
    typeof dynamicVars.child_id === 'string' ? dynamicVars.child_id : null;
  const parentId =
    typeof dynamicVars.parent_id === 'string' ? dynamicVars.parent_id : null;

  if (!childId || !parentId) {
    console.warn(
      '[voice-webhook] missing child_id/parent_id in dynamic_variables — conversation',
      data.conversation_id
    );
    return Response.json({ ok: true, skipped: 'no-meta' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'supabase not configured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Bail if we've already persisted this conversation — protects against EL
  // retries. conversation_id from EL is the natural dedupe key.
  const conversationUuid = elConversationToUuid(data.conversation_id);
  const { data: existing } = await admin
    .from('chat_messages')
    .select('id')
    .eq('conversation_id', conversationUuid)
    .eq('mode', 'voice')
    .limit(1);
  if (existing && existing.length > 0) {
    return Response.json({ ok: true, skipped: 'already-persisted' });
  }

  const turns = Array.isArray(data.transcript) ? data.transcript : [];
  const baseStart = (data.metadata?.start_time_unix_secs ?? 0) * 1000;
  const rows = turns
    .filter((t) => t && typeof t.message === 'string' && t.message.trim() !== '')
    .map((t) => ({
      child_id: childId,
      parent_id: parentId,
      conversation_id: conversationUuid,
      role: t.role === 'agent' ? 'assistant' : 'user',
      content: t.message,
      mode: 'voice',
      created_at: baseStart
        ? new Date(baseStart + (t.time_in_call_secs ?? 0) * 1000).toISOString()
        : new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return Response.json({ ok: true, persisted: 0 });
  }

  const { error } = await admin.from('chat_messages').insert(rows);
  if (error) {
    console.error('[voice-webhook] insert failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    persisted: rows.length,
    conversation_id: data.conversation_id,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Turn = {
  role?: string;
  message?: string;
  time_in_call_secs?: number;
};

type WebhookPayload = {
  type?: string;
  event_timestamp?: number;
  data?: {
    agent_id?: string;
    conversation_id: string;
    status?: string;
    transcript?: Turn[];
    metadata?: { start_time_unix_secs?: number; call_duration_secs?: number };
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, unknown>;
    };
  };
};

// ElevenLabs uses Stripe-style signatures: `t=<unix>,v0=<hex>`. Body that gets
// HMAC'd is `${timestamp}.${rawBody}`. 30-minute tolerance per their docs.
function verifySignature(rawBody: string, header: string, secret: string): boolean {
  if (!header) return false;

  const parts = header.split(',').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  // Path A: Stripe-style t=...,v0=...
  if (parts.t && parts.v0) {
    const ts = Number(parts.t);
    if (!Number.isFinite(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 30 * 60) return false;
    const expected = createHmac('sha256', secret)
      .update(`${parts.t}.${rawBody}`)
      .digest('hex');
    return safeEqualHex(expected, parts.v0);
  }

  // Path B (fallback): raw hex of body. Some envs send the unwrapped digest.
  const fallback = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(fallback, header.trim());
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// chat_messages.conversation_id is a uuid. EL's conversation_id is an opaque
// string like `conv_2001krx98bdbfdp8rszs4e42xf7s`. Hash it deterministically
// to a uuidv5-ish bytes -> uuid form so we can dedupe + relate later.
function elConversationToUuid(elId: string): string {
  // SHA-256 the EL id, take first 16 bytes, format as v5-ish uuid string.
  const h = createHmac('sha256', 'cu3e-voice').update(elId).digest();
  const b = h.subarray(0, 16);
  // Force version=5 and variant=10xx so the value is a syntactically valid uuid.
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
