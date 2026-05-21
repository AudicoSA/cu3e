import { experimental_generateImage as generateImage } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import {
  SKILL_LESSONS,
  SKILL_CATEGORY_BY_ID,
  type SkillLesson,
} from '@/lib/skills';

export const maxDuration = 300; // 5 min; route trickles through the 50 modules

type Body = {
  // Optional filter: only seed these lesson ids. Useful for re-rolling a
  // specific tile that came out wrong.
  only?: string[];
  // If true, overwrite existing tiles. Default false so re-runs are cheap.
  force?: boolean;
};

// One-time tile background generator. Iterates over SKILL_LESSONS, asks
// Gemini Nano Banana for a stylised illustration per module, and writes
// to the `skill-images` public bucket at `<lesson_id>.png`.
//
// Bearer-auth gated via SEED_SHARED_SECRET so this isn't a free DDoS for
// anyone who stumbles on the URL. The model itself (gemini-2.5-flash-image)
// runs on Google's free tier and costs nothing per call.
export async function POST(req: Request) {
  const expected = process.env.SEED_SHARED_SECRET || process.env.VOICE_LLM_SHARED_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!expected || token !== expected) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = (await req.json().catch(() => ({}))) as Body;
  const filter = new Set(body.only ?? []);
  const force = body.force === true;

  // List existing files once so we can skip ones we already have unless
  // `force` is set.
  const existing = new Set<string>();
  if (!force) {
    const { data: list } = await admin.storage.from('skill-images').list('', { limit: 1000 });
    for (const f of list ?? []) existing.add(f.name);
  }

  const todo: SkillLesson[] = SKILL_LESSONS.filter((s) => {
    if (filter.size > 0 && !filter.has(s.id)) return false;
    if (!force && existing.has(`${s.id}.png`)) return false;
    return true;
  });

  const results = {
    requested: SKILL_LESSONS.length,
    skipped_existing: SKILL_LESSONS.length - todo.length - (filter.size > 0 ? SKILL_LESSONS.length - filter.size : 0),
    generated: 0,
    failed: [] as Array<{ id: string; error: string }>,
  };

  // Process sequentially to stay polite on the free tier and to keep the
  // route under its time budget. ~3-5s per call × 50 ≈ 3 minutes worst case.
  for (const lesson of todo) {
    try {
      const prompt = buildPrompt(lesson);
      const { image } = await generateImage({
        model: google.image('gemini-2.5-flash-image'),
        prompt,
        aspectRatio: '4:3',
      });
      const buffer = Buffer.from(image.base64, 'base64');
      const { error: upErr } = await admin.storage
        .from('skill-images')
        .upload(`${lesson.id}.png`, buffer, {
          contentType: image.mediaType ?? 'image/png',
          upsert: true,
        });
      if (upErr) {
        results.failed.push({ id: lesson.id, error: upErr.message });
        continue;
      }
      results.generated += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.failed.push({ id: lesson.id, error: msg });
    }
  }

  return Response.json({ ok: true, ...results });
}

function buildPrompt(lesson: SkillLesson): string {
  const cat = SKILL_CATEGORY_BY_ID.get(lesson.category);
  const accent = cat?.accent ?? '#8a6bff';

  // The art direction here is the brand: clean, slightly retro-futurist
  // editorial illustration, generous negative space (text overlays on top),
  // never realistic. Echo's voice — playful, smart, not childish.
  return `Editorial illustration for a children/teen learning platform called CU3E. Topic: "${lesson.title}". ${lesson.pitch}

Style: stylised, flat editorial illustration with soft gradients. Single hero subject, generous negative space at the top-left for a text overlay (so do NOT include any text in the image). A bold primary accent colour around ${accent}, against a deep midnight-blue background (#0a0b10 to #14152a). Slight grain. Avoid corporate stock-photo style. Avoid photorealism. Avoid kid-cartoon clichés (no smiling sun, no rainbow). Think New Yorker meets Pixar concept art.

Composition: 4:3, the subject sits right-of-center. No watermark, no logo, no caption.`;
}
