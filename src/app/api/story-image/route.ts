import { experimental_generateImage as generateImage } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 30;

type Mode = 'tutor' | 'storybook';

type Body = {
  scene: string;
  storySoFar?: string;
  age?: number | null;
  mode?: Mode;
  conversationId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  // Auth gate — we don't want unauthenticated clients hammering image gen.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Only run for storybook for now — tutor doesn't need scene images.
  if (body.mode && body.mode !== 'storybook') {
    return Response.json({ error: 'image gen only available in storybook mode' }, { status: 400 });
  }

  const sceneText = body.scene?.trim();
  if (!sceneText) {
    return Response.json({ error: 'scene is required' }, { status: 400 });
  }

  const ageHint =
    typeof body.age === 'number' && body.age <= 9
      ? "Soft, friendly, picture-book style for a young child. Bright cheerful colours. Rounded shapes. Like a children's book illustration. No scary imagery, no dark themes."
      : 'Stylised storybook illustration, slightly more sophisticated. Painterly, expressive. Suitable for a 10-14 year old. Avoid anything graphic or frightening.';

  const prompt = `Children's storybook illustration of this scene: ${sceneText}.

Style: ${ageHint}

Composition: single illustrated scene, no text, no captions, no speech bubbles, no watermark.${
    body.storySoFar
      ? `\n\nStory context so far (for consistency, do not depict literally): ${body.storySoFar.slice(0, 600)}`
      : ''
  }`;

  try {
    const { image } = await generateImage({
      // gemini-2.5-flash-image ("Nano Banana") works on Google AI free tier.
      // Imagen 4 is image-quality king but requires billing.
      model: google.image('gemini-2.5-flash-image'),
      prompt,
      aspectRatio: '4:3',
    });

    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;

    // Persist to Supabase storage so kids can revisit illustrated stories
    // later. Path: <parent_id>/<conversation_id>/<ts>.png
    // Failures here are non-fatal — we still return the dataUrl for display.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let storagePath: string | null = null;
    if (supabaseUrl && serviceKey && body.conversationId) {
      const ts = Date.now();
      const ext = image.mediaType === 'image/jpeg' ? 'jpg' : image.mediaType === 'image/webp' ? 'webp' : 'png';
      storagePath = `${user.id}/${body.conversationId}/${ts}.${ext}`;
      const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const buffer = Buffer.from(image.base64, 'base64');
      const { error: upErr } = await admin.storage
        .from('story-images')
        .upload(storagePath, buffer, {
          contentType: image.mediaType,
          upsert: false,
        });
      if (upErr) {
        console.warn('[story-image] storage upload failed:', upErr.message);
        storagePath = null;
      } else {
        // Link the storage path back to the assistant message it illustrated
        // so the chat can rehydrate scenes on reload. We can't use the
        // client-side AI SDK message id (it doesn't match chat_messages.id),
        // so we attach to the most recent assistant turn for this conv.
        // The chat route persists the assistant row inside `onFinish`, which
        // is awaited before the stream closes — by the time the client
        // dispatches the image request the row is normally already there.
        const { data: target, error: findErr } = await admin
          .from('chat_messages')
          .select('id')
          .eq('parent_id', user.id)
          .eq('conversation_id', body.conversationId)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (findErr) {
          console.warn('[story-image] find assistant msg failed:', findErr.message);
        } else if (target?.id) {
          const { error: linkErr } = await admin
            .from('chat_messages')
            .update({ storybook_image_path: storagePath })
            .eq('id', target.id);
          if (linkErr) console.warn('[story-image] link failed:', linkErr.message);
        }
      }
    }

    return Response.json({ image: dataUrl, storagePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[story-image] generate failed:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
