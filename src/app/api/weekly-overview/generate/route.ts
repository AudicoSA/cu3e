import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60;

type ChildRow = { id: string; first_name: string; age: number | null; grade: string | null };
type ChatRow = {
  child_id: string;
  role: string;
  content: string;
  created_at: string;
  mode: string;
};

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return Response.json(
      { error: 'voice not configured (missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID)' },
      { status: 500 }
    );
  }

  // 1. Pull the past 7 days of chat_messages for all of this parent's children.
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const periodEnd = new Date();

  const { data: children } = await supabase
    .from('children')
    .select('id, first_name, age, grade')
    .eq('parent_id', user.id);

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('child_id, role, content, created_at, mode')
    .eq('parent_id', user.id)
    .gte('created_at', periodStart.toISOString())
    .order('created_at', { ascending: true });

  const childList = (children ?? []) as ChildRow[];
  const messageList = (messages ?? []) as ChatRow[];

  if (messageList.length === 0) {
    return Response.json(
      { error: 'no_activity', detail: 'No conversations in the past 7 days yet — nothing to summarise.' },
      { status: 400 }
    );
  }

  // 2. Build the digest source — keep it compact, group by child.
  const childById = new Map(childList.map((c) => [c.id, c]));
  const byChild = new Map<string, ChatRow[]>();
  for (const m of messageList) {
    if (!byChild.has(m.child_id)) byChild.set(m.child_id, []);
    byChild.get(m.child_id)!.push(m);
  }

  const corpus = Array.from(byChild.entries())
    .map(([childId, msgs]) => {
      const c = childById.get(childId);
      const name = c?.first_name ?? 'A child';
      const age = c?.age ? `age ${c.age}` : '';
      const grade = c?.grade ? `, ${c.grade}` : '';
      const lines = msgs
        .map((m) => {
          const speaker = m.role === 'user' ? name : 'Echo';
          const modeTag = m.mode && m.mode !== 'tutor' ? ` [${m.mode}]` : '';
          const text = m.content.replace(/\s+/g, ' ').slice(0, 400);
          return `${speaker}${modeTag}: ${text}`;
        })
        .join('\n');
      return `=== ${name} (${age}${grade}) ===\n${lines}`;
    })
    .join('\n\n');

  // 3. Ask Claude for a short, parent-facing weekly digest.
  const system = `You are writing a WEEKLY VOICE DIGEST for a parent — to be read aloud by Echo, an AI tutor their child uses.

The parent will LISTEN to this in their car. So:
- Plain prose, no lists, no headings, no markdown. This is read aloud.
- 250 to 400 words total — about 2 to 3 minutes of audio.
- Warm but honest. Don't pretend everything was amazing if it wasn't.
- Cover each child by name. If only one child has activity, just cover that one.
- For each child, mention: what they worked on most, one moment that stood out (a breakthrough, a smart question, or a struggle), and one suggestion for the parent.
- Open like a friend updating them — "Hey, here's what your kids got up to with me this week..."
- End with a quick warm closer that invites them to keep going.

Do NOT use kid quotes verbatim if they're embarrassing — paraphrase. Be a good co-parent.`;

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system,
    prompt: `Here are this week's CU3E conversations for one family. Write the voice digest.\n\n${corpus.slice(0, 16000)}`,
    maxRetries: 1,
  });

  const transcript = result.text.trim();
  if (!transcript) {
    return Response.json({ error: 'empty_summary' }, { status: 500 });
  }

  // 4. ElevenLabs TTS — same Ava voice as Echo.
  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: transcript,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
      }),
    }
  );

  if (!ttsResponse.ok) {
    const errBody = await ttsResponse.text();
    console.error('[weekly-overview] tts failed:', ttsResponse.status, errBody);
    return Response.json({ error: `tts_failed_${ttsResponse.status}` }, { status: 500 });
  }

  const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
  if (audioBuffer.length === 0) {
    console.error('[weekly-overview] empty audio buffer from ElevenLabs');
    return Response.json({ error: 'tts_empty_audio' }, { status: 500 });
  }

  // 5. Upload audio to Supabase Storage ("overviews" bucket, per-user folder).
  // Use the service-role admin client — this is a server-only operation, no
  // need to depend on the parent's RLS policies firing correctly. Also gives
  // us a real error message we can show the user if anything breaks.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'storage not configured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const storagePath = `${user.id}/${Date.now()}.mp3`;
  const { error: uploadError } = await admin.storage
    .from('overviews')
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('[weekly-overview] upload failed:', uploadError.message);
    // Audio is the whole point — surface the failure rather than silently
    // returning a transcript-only result the user can't tell apart from "no
    // activity this week".
    return Response.json(
      {
        error: 'audio_upload_failed',
        detail: uploadError.message,
      },
      { status: 500 }
    );
  }

  // 6. Persist the record.
  const { data: inserted, error: insertError } = await admin
    .from('weekly_overviews')
    .insert({
      parent_id: user.id,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      transcript,
      audio_storage_path: storagePath,
      message_count: messageList.length,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[weekly-overview] insert failed:', insertError.message);
  }

  // 7. Return everything the client needs to play it.
  const { data: signedUrlData } = await admin.storage
    .from('overviews')
    .createSignedUrl(storagePath, 60 * 60); // valid 1h
  const audioUrl = signedUrlData?.signedUrl ?? null;

  return Response.json({
    id: inserted?.id ?? null,
    transcript,
    audioUrl,
    messageCount: messageList.length,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });
}
