import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { randomUUID } from 'node:crypto';

export const maxDuration = 30;

// Promote one of this parent's uploaded curriculum_documents into the shared
// curriculum_library, so other families can one-click activate the same PDF.
// We copy the file under a `library/<new-id>.pdf` path so the original parent
// can still delete their copy without breaking the library entry.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    document_id?: string;
    region?: string;
    grade?: string;
    subject?: string;
    title?: string;
    description?: string;
  };
  const { document_id, region, grade, subject, title, description } = body;

  if (!document_id || !region || !subject || !title) {
    return Response.json(
      { error: 'document_id, region, subject and title are all required' },
      { status: 400 }
    );
  }

  const allowedRegions = new Set(['CAPS', 'CommonCore', 'GCSE', 'IB', 'Other']);
  if (!allowedRegions.has(region)) {
    return Response.json({ error: `region must be one of ${[...allowedRegions].join(', ')}` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // RLS ensures the parent can only see their own kids' docs. Make sure they
  // actually own this one before we promote.
  const { data: docRow, error: docErr } = await supabase
    .from('curriculum_documents')
    .select('id, storage_path, filename, child_id')
    .eq('id', document_id)
    .maybeSingle();
  if (docErr || !docRow) {
    return Response.json({ error: 'document not found' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const libraryId = randomUUID();
  const libraryPath = `library/${libraryId}.pdf`;

  // Copy the existing PDF to the shared library/ path so it's independent of
  // the original parent's lifecycle (deletes, child re-org, etc).
  const { error: copyErr } = await admin.storage
    .from('curriculum')
    .copy(docRow.storage_path, libraryPath);
  if (copyErr) {
    return Response.json({ error: `copy failed: ${copyErr.message}` }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await admin
    .from('curriculum_library')
    .insert({
      id: libraryId,
      region,
      grade: grade || null,
      subject,
      title,
      description: description || null,
      storage_path: libraryPath,
      source_attribution: 'Shared by a CU3E parent',
      is_published: true,
    })
    .select('id, title, storage_path')
    .single();
  if (insErr) {
    // Try to clean up the orphaned file
    await admin.storage.from('curriculum').remove([libraryPath]).catch(() => {});
    return Response.json({ error: `db insert failed: ${insErr.message}` }, { status: 500 });
  }

  return Response.json({
    ok: true,
    library_id: inserted?.id,
    title: inserted?.title,
  });
}
