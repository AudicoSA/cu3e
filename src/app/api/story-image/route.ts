import { experimental_generateImage as generateImage } from 'ai';
import { google } from '@ai-sdk/google';
import { createServerClient, type CookieMethodsServerDeprecated } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const maxDuration = 30;

type Mode = 'tutor' | 'storybook';

type Body = {
  scene: string;
  storySoFar?: string;
  age?: number | null;
  mode?: Mode;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  // Auth gate — we don't want unauthenticated clients hammering image gen.
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

    // Image is a GeneratedFile; return base64 data URL the client can render
    // directly without us needing storage.
    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;
    return Response.json({ image: dataUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[story-image] generate failed:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
