import { generateText, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60;

// Pre-extracts verbatim text from an uploaded curriculum PDF using Claude
// Sonnet 4.6's vision. Runs ONCE on upload (and on demand for backfill),
// then voice + text Echo read from `extracted_text` on each turn — no more
// per-turn PDF processing.
//
// Why Claude and not pdf-parse: image-only / scanned PDFs (which is most
// homework worksheets) yield zero text from pdf-parse. Claude reads them
// natively.
export async function POST(req: Request) {
  const body = (await req.json()) as { document_id?: string };
  const documentId = body.document_id;
  if (!documentId) {
    return Response.json({ error: 'missing document_id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // RLS will enforce ownership: parent can only read their own children's docs.
  const { data: docRow, error: docErr } = await supabase
    .from('curriculum_documents')
    .select('id, storage_path, filename, child_id, extracted_text')
    .eq('id', documentId)
    .maybeSingle();
  if (docErr || !docRow) {
    return Response.json({ error: 'document not found' }, { status: 404 });
  }

  // Service-role client for the storage download — bucket may be private.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }
  const admin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: fileData, error: dlErr } = await admin.storage
    .from('curriculum')
    .download(docRow.storage_path);
  if (dlErr || !fileData) {
    return Response.json({ error: `download failed: ${dlErr?.message ?? 'unknown'}` }, { status: 500 });
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Extract the full verbatim text from this PDF homework worksheet. Include every question number, every fraction, every instruction, every example, every header — exactly as it appears. Preserve question numbering. Do not summarise, comment, paraphrase, or add anything of your own. Output ONLY the extracted text.',
        },
        {
          type: 'file',
          data: buffer,
          mediaType: 'application/pdf',
          filename: docRow.filename,
        },
      ],
    },
  ];

  let extractedText = '';
  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      messages,
      maxRetries: 1,
    });
    extractedText = (result.text ?? '').trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `extract failed: ${msg}` }, { status: 500 });
  }

  if (!extractedText) {
    return Response.json({ error: 'claude returned empty text' }, { status: 500 });
  }

  const { error: updErr } = await admin
    .from('curriculum_documents')
    .update({
      extracted_text: extractedText,
      extracted_at: new Date().toISOString(),
    })
    .eq('id', documentId);
  if (updErr) {
    return Response.json({ error: `db update failed: ${updErr.message}` }, { status: 500 });
  }

  return Response.json({
    ok: true,
    document_id: documentId,
    filename: docRow.filename,
    text_length: extractedText.length,
  });
}
