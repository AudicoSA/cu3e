import { createClient } from '@/utils/supabase/server';

export const maxDuration = 30;

type Body = { childId?: string };

// Returns a short-lived signed URL the browser can use to open a WebSocket
// session with the Echo conversational agent on ElevenLabs — plus a set of
// dynamic variables that get interpolated into the agent's system prompt so
// Echo knows which kid is talking and what they've been working on.
//
// The URL embeds auth — never expose ELEVENLABS_API_KEY to the client.
export async function POST(req: Request) {
  // Auth gate — only logged-in parents can start voice sessions.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return Response.json(
      { error: 'voice not configured (missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID)' },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const requestedChildId = body.childId;

  // --- Build child context for dynamic variables ---
  // The agent's system prompt has placeholders like {{child_name}} etc.
  // We fill them here so Echo opens with relevant context.

  let childName = "your friend";
  let childAge: number | null = null;
  let childGrade: string | null = null;
  let recentSummary = "no recent topics yet";
  let ageBand = "big"; // 'little' = age <= 9, 'big' = age 10+

  if (requestedChildId) {
    const { data: childRow } = await supabase
      .from('children')
      .select('id, first_name, age, grade, memory_brief')
      .eq('id', requestedChildId)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childRow) {
      childName = childRow.first_name as string;
      childAge = (childRow.age as number) ?? null;
      childGrade = (childRow.grade as string) ?? null;
      if (typeof childAge === 'number' && childAge <= 9) ageBand = 'little';

      // Use the daily-refreshed memory_brief from children.memory_brief as the
      // recent-topics context for the EL agent prompt. The brief is built by
      // lib/memory.refreshChildMemory after each chat session and covers the
      // last 30 days. Replaces the per-session Haiku summarisation that
      // used to live here (one less call on every voice connect).
      const brief = (childRow.memory_brief as string | null) ?? null;
      if (brief && brief.trim()) recentSummary = brief.trim();
    }
  }

  const ageLabel = typeof childAge === 'number' ? `${childAge} years old` : 'an unknown age';
  const gradeLabel = childGrade ? ` (${childGrade})` : '';

  const dynamicVariables: Record<string, string> = {
    child_name: childName,
    child_age: ageLabel,
    child_grade: childGrade ?? '',
    age_band: ageBand,
    recent_topics: recentSummary,
    voice_band_instruction:
      ageBand === 'little'
        ? `You are talking to ${childName}, ${ageLabel}${gradeLabel}. Match their level: short words, gentler tone, playful. One idea per sentence.`
        : `You are talking to ${childName}, ${ageLabel}${gradeLabel}. Talk like a smart older friend — direct, curious, a little dry. Trust them.`,
    // Phase C — these are embedded in the agent system prompt so our custom LLM
    // endpoint can identify the child without a user session.
    child_id: requestedChildId ?? '',
    parent_id: user.id,
  };

  // --- Get signed URL from ElevenLabs ---
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (!r.ok) {
      const body = await r.text();
      console.error('[voice-session] signed-url fetch failed:', r.status, body);
      return Response.json({ error: `elevenlabs ${r.status}` }, { status: 500 });
    }

    const data = (await r.json()) as { signed_url?: string };
    if (!data.signed_url) {
      return Response.json({ error: 'no signed_url in response' }, { status: 500 });
    }

    // Second voice for the 'big' age band (>=10). Kids older than 9 find the
    // playful agent voice too childish; this lets us override at session-open
    // without spinning up a second agent. ELEVENLABS_VOICE_ID_MATURE must be
    // set in env; if unset, fall through to the agent's default voice.
    const matureVoiceId = process.env.ELEVENLABS_VOICE_ID_MATURE || null;
    const ttsVoiceId = ageBand === 'big' && matureVoiceId ? matureVoiceId : null;

    return Response.json({
      signedUrl: data.signed_url,
      dynamicVariables,
      ttsVoiceId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice-session] error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
