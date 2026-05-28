import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/utils/supabase/server';
import { buildLanguageHint, isSupportedLanguage, voiceIdForLanguage, type LanguageCode } from '@/lib/languages';

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

  let langCode: LanguageCode = 'en';

  if (requestedChildId) {
    const { data: childRow } = await supabase
      .from('children')
      .select('id, first_name, age, grade, memory_brief, preferred_language')
      .eq('id', requestedChildId)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childRow) {
      childName = childRow.first_name as string;
      childAge = (childRow.age as number) ?? null;
      childGrade = (childRow.grade as string) ?? null;
      if (typeof childAge === 'number' && childAge <= 9) ageBand = 'little';
      if (isSupportedLanguage(childRow.preferred_language as string | null)) {
        langCode = childRow.preferred_language as LanguageCode;
      }

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

      // Hours since the most recent message in chat_messages. Drives the
      // "is this a fresh day or a continuation?" branch below.
      let hoursSinceLast: number | null = null;
      if (recentMsgs && recentMsgs[0]?.created_at) {
        hoursSinceLast = (Date.now() - new Date(recentMsgs[0].created_at as string).getTime()) / (1000 * 60 * 60);
      }
      const isFreshDay = hoursSinceLast === null || hoursSinceLast > 12;

      console.log('[voice-session] memory',
        JSON.stringify({
          child: childName,
          hasBrief: !!brief,
          briefLen: brief?.length ?? 0,
          recentCount: recentMsgs?.length ?? 0,
        })
      );

      // Opener policy as of Ella-exam-prep feedback (2026-05-27):
      // ALWAYS open generic + fresh. Do not reference yesterday's topic,
      // do not reference what they were "in the middle of", do not pull
      // anything specific from memory_brief into the spoken line. The
      // kid sets the agenda — Echo just opens the door.
      //
      // Reason: when Ella sat down to study for exams, Echo opened with
      // "we left off on AI ethics, want to dig back in or pivot to
      // fractions?" — that combination of stale context + binary choice
      // made her give up and use ChatGPT instead. Background memory
      // still informs Echo's RESPONSES (in voice-llm), it just doesn't
      // leak into the opener.
      //
      // hoursSinceLast is kept in logs so we can observe behaviour
      // shifts; it no longer branches the prompt.
      void hoursSinceLast;
      void isFreshDay;
      void lastBriefLines;

      if (haveRecent || (brief && brief.trim().length > 0)) {
        const langName = buildLanguageHint(langCode);
        const synthPrompt = `You are crafting the OPENING LINE that voice-Echo will speak the moment ${childName} starts a chat.

LANGUAGE: write the line in ${langName}.${langCode !== 'en' ? ` Natural, age-appropriate ${langName} — not stilted textbook ${langName}.` : ''}

The opener is GENERIC + FRESH. Do NOT bring up specific topics from any previous chat. Do NOT reference what ${childName} was working on, stuck on, or interrupted on. Do NOT say "last time" or "we were doing" or "ready to pick that up". ${childName} sets the agenda — your job is to open the door warmly and step out of the way.

Constraints:
- ONE warm spoken sentence, max 18 words.
- ${ageBand === 'little' ? 'Match a 6-9 year-old tone: simple, warm, a touch playful.' : 'Match a 10+ tone: smart-older-friend, direct, not gushy.'}
- End with at most ONE light question that hands control to ${childName}.
- No quotes, no preamble, no emoji.

Examples of GOOD openers (this is the entire style range):
- "Hey ${childName} — what's on your mind?"
- "Hey ${childName}, what shall we get into?"
- "Morning ${childName}, what's the plan?"
- "Hi ${childName} — over to you."
- "Hey ${childName}, ready when you are."

BANNED (do NOT produce anything resembling these):
- "Hey ${childName} — last time we were doing X..."
- "Want to keep going with the fractions / story / topic?"
- "Ready to dig back in or switch?"
- Any reference to specific homework topics, names, places, or themes from a previous chat.

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
    // ISO 639-1 code (en/af/zu). EL also gets it via the overrides we return
    // below; this dynamic var lets the agent's system-prompt template
    // reference {{preferred_language}} if it ever needs to.
    preferred_language: langCode,
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

    // Voice ID priority (first match wins):
    //   1. Per-language voice (Adele for Afrikaans, Thandi for isiZulu).
    //      A 12yo Afrikaans kid hears the Afrikaans voice, not the mature
    //      English one — language coherence trumps age coherence.
    //   2. Mature voice for the 'big' age band (>=10) via env var
    //      ELEVENLABS_VOICE_ID_MATURE. English-only fallback for older kids.
    //   3. null → fall through to the agent's default voice.
    let langVoiceId = voiceIdForLanguage(langCode);
    const matureVoiceId = process.env.ELEVENLABS_VOICE_ID_MATURE || null;

    // Pre-flight: if a voice override is set but the voice isn't actually
    // in the workspace library, EL silently fails the WebSocket connection
    // → kids stuck on "Connecting" forever. Verify first; if missing,
    // unset the override (we'd rather fall back to the agent default than
    // brick voice mode for the whole session).
    if (langVoiceId) {
      try {
        const check = await fetch(`https://api.elevenlabs.io/v1/voices/${langVoiceId}`, {
          headers: { 'xi-api-key': apiKey },
          // short timeout via abort signal — never let the preflight hold
          // up the whole route
          signal: AbortSignal.timeout(3000),
        });
        if (!check.ok) {
          console.warn(`[voice-session] voice ${langVoiceId} for ${langCode} not in library (${check.status}) — falling back to agent default`);
          langVoiceId = null;
        }
      } catch (e) {
        console.warn('[voice-session] voice preflight failed:', e instanceof Error ? e.message : String(e));
        langVoiceId = null;
      }
    }

    const ttsVoiceId =
      langVoiceId
      ?? (ageBand === 'big' && matureVoiceId ? matureVoiceId : null);

    return Response.json({
      signedUrl: data.signed_url,
      dynamicVariables,
      ttsVoiceId,
      // ISO 639-1 language code — VoiceTalk passes this as
      // overrides.agent.language so EL's STT + agent know which language
      // the kid is speaking. Without this, EL defaults to the agent's
      // configured language (English) and Afrikaans/Zulu STT degrades.
      languageCode: langCode,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice-session] error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
