import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 30;

type Body = { childId?: string };

// Returns a short-lived signed URL the browser can use to open a WebSocket
// session with the Echo conversational agent on ElevenLabs — plus a set of
// dynamic variables that get interpolated into the agent's system prompt so
// Echo knows which kid is talking and what they've been working on.
//
// IMPORTANT: ElevenLabs agents have their OWN "first message" template that
// runs BEFORE our custom-LLM endpoint is invoked. So memory_brief in the
// system prompt doesn't reach the opener. To make Echo's greeting actually
// memory-aware, we compute a one-line continuation opener server-side
// (`opening_line` below) and expose it as a dynamic variable. The EL agent's
// first_message should be set to `{{opening_line}}` in EL UI — then every
// session opens with real continuity instead of a stock "Hey, what are we
// working on today?".
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
  let childName = "your friend";
  let childAge: number | null = null;
  let childGrade: string | null = null;
  let recentSummary = "no recent topics yet";
  let openingLine = "Hey there — what shall we get into today?";
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

      const brief = (childRow.memory_brief as string | null) ?? null;
      if (brief && brief.trim()) recentSummary = brief.trim();

      // Default opener if we can't synthesise something better.
      openingLine = `Hey ${childName} — what shall we get into today?`;

      // Pull the most recent chat turns (any mode) within the last 24h so
      // the opener can pick up DIRECTLY from where the last session left off
      // — even if memory_brief hasn't refreshed yet.
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMsgs } = await supabase
        .from('chat_messages')
        .select('role, content, mode, created_at')
        .eq('child_id', childRow.id)
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false })
        .limit(8);

      const haveRecent = (recentMsgs?.length ?? 0) >= 2;
      const lastBriefLines = brief
        ? brief.split('\n').slice(0, 4).join('\n')
        : '';

      console.log('[voice-session] memory',
        JSON.stringify({
          child: childName,
          hasBrief: !!brief,
          briefLen: brief?.length ?? 0,
          recentCount: recentMsgs?.length ?? 0,
        })
      );

      if (haveRecent || (brief && brief.trim().length > 0)) {
        const transcript = (recentMsgs ?? [])
          .slice()
          .reverse()
          .map((r) => {
            const who = r.role === 'user' ? childName : 'Echo';
            const tag = r.mode && r.mode !== 'tutor' ? ` [${r.mode}]` : '';
            return `${who}${tag}: ${String(r.content).replace(/\s+/g, ' ').slice(0, 180)}`;
          })
          .join('\n');

        const synthPrompt = `You are crafting the OPENING LINE that voice-Echo will speak the moment ${childName} starts a chat. Echo's job is to make ${childName} feel REMEMBERED — pick up from where things left off the most recently.

Use whichever has more useful detail: the recent chats below (if present), or the running memory brief, or both.

Constraints:
- ONE warm spoken sentence, max 22 words.
- Reference something SPECIFIC they were doing (a topic, a question, a story, a stuck point) — not generic praise.
- ${ageBand === 'little' ? 'Match a 6-9 year-old tone: simple, warm, a touch playful.' : 'Match a 10+ tone: smart-older-friend, direct, not gushy.'}
- End by inviting them to keep going OR start something new — but only ONE question.
- No quotes, no preamble, no "Hey there" cliches if you can name the topic.

If neither source has anything specific to pick up from, output exactly: "Hey ${childName} — what shall we get into today?"

RECENT CHATS (most recent first to last):
${transcript || '(none)'}

MEMORY BRIEF (running summary):
${lastBriefLines || '(none)'}

Output: just the spoken line.`;

        try {
          const { text } = await generateText({
            model: anthropic('claude-haiku-4-5-20251001'),
            messages: [{ role: 'user', content: synthPrompt }],
            maxRetries: 1,
          });
          const synth = (text ?? '').trim().replace(/^["'`]|["'`]$/g, '');
          if (synth && synth.length <= 240) openingLine = synth;
        } catch (e) {
          console.warn('[voice-session] opener synth failed:',
            e instanceof Error ? e.message : String(e));
        }
      }
    }
  }

  console.log('[voice-session] opener',
    JSON.stringify({ child: childName, opening: openingLine.slice(0, 100) })
  );

  const ageLabel = typeof childAge === 'number' ? `${childAge} years old` : 'an unknown age';
  const gradeLabel = childGrade ? ` (${childGrade})` : '';

  const dynamicVariables: Record<string, string> = {
    child_name: childName,
    child_age: ageLabel,
    child_grade: childGrade ?? '',
    age_band: ageBand,
    recent_topics: recentSummary,
    // Set the ElevenLabs agent's "First message" template to: {{opening_line}}
    // so the very first thing Echo says picks up from the last conversation.
    opening_line: openingLine,
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
