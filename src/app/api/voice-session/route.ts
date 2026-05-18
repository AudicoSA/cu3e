import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createServerClient, type CookieMethodsServerDeprecated } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
      .select('id, first_name, age, grade')
      .eq('id', requestedChildId)
      .eq('parent_id', user.id)
      .maybeSingle();

    if (childRow) {
      childName = childRow.first_name as string;
      childAge = (childRow.age as number) ?? null;
      childGrade = (childRow.grade as string) ?? null;
      if (typeof childAge === 'number' && childAge <= 9) ageBand = 'little';

      // Pull the kid's most recent turns (both sides of the conversation,
      // last 14 days) so Haiku can summarise the actual context — not just
      // user-side fragments.
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentRows } = await supabase
        .from('chat_messages')
        .select('role, content, mode, created_at')
        .eq('child_id', childRow.id)
        .gte('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(40);

      if (recentRows && recentRows.length > 0) {
        // Order oldest → newest so the summary reads chronologically.
        const ordered = [...recentRows].reverse();
        const transcript = ordered
          .map((r) => {
            const who = r.role === 'user' ? childName : 'Echo';
            const tag = r.mode && r.mode !== 'tutor' ? ` [${r.mode}]` : '';
            const snippet = String(r.content).replace(/\s+/g, ' ').slice(0, 200);
            return `${who}${tag}: ${snippet}`;
          })
          .join('\n');

        try {
          const { text } = await generateText({
            model: anthropic('claude-haiku-4-5-20251001'),
            messages: [
              {
                role: 'user',
                content: `Summarise what ${childName} (a kid) has been working on with Echo lately, based on these recent chats. ONE OR TWO short sentences max. Mention specific topics or worksheets if obvious. If they got stuck somewhere, name it. If they had a breakthrough, name it. No preamble, no quotes, no "the child" — refer to ${childName} by name. Just the summary, plain text.\n\nCHATS:\n${transcript}`,
              },
            ],
            maxRetries: 1,
          });
          const summary = (text ?? '').trim();
          if (summary) recentSummary = summary;
        } catch (e) {
          console.warn(
            '[voice-session] recent-topics summary failed:',
            e instanceof Error ? e.message : String(e)
          );
          // Fall back to the raw-bullet form so Echo still has SOME context.
          const lines = ordered
            .filter((r) => r.role === 'user')
            .slice(-6)
            .map((r) => `- ${String(r.content).replace(/\s+/g, ' ').slice(0, 120)}`);
          if (lines.length > 0) recentSummary = lines.join('\n');
        }
      }
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

    return Response.json({
      signedUrl: data.signed_url,
      dynamicVariables,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[voice-session] error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
