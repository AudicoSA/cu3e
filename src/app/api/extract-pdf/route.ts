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
          text: `Extract the contents of this PDF homework worksheet for an AI tutor that will be helping the child. The tutor cannot see the PDF itself — only your extraction — so be exhaustive.

For every page, capture:
1. ALL printed text: titles, instructions, question numbers, math expressions, fractions, blanks, answer choices.
2. ALL pictures/illustrations: describe WHAT is drawn in each question (fish, balloons, pizza slices, apples, circles, bars, pie charts, etc.) and HOW MANY there are, including which are shaded/coloured vs blank.
3. The visual structure: which picture belongs to which question number.

Output format:
- One page per section, separated by "---".
- For each question, write: \`Q<number>: <printed text>. Picture: <description>.\` if there's a picture, otherwise just the text.
- Preserve original question numbering (a, b, c, 1, 2, 3 etc).
- Do not summarise. Do not paraphrase. Do not solve. Output ONLY the structured extraction.`,
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

  // Count labelled questions from the extraction so the in-chat progress
  // bar knows what 100% looks like for this PDF. Our prompt writes each
  // question as `Qa:` / `Q1:` etc., so matching that pattern catches them all.
  const questionCount = countQuestions(extractedText);

  const { error: updErr } = await admin
    .from('curriculum_documents')
    .update({
      extracted_text: extractedText,
      extracted_at: new Date().toISOString(),
      question_count: questionCount,
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
    question_count: questionCount,
  });
}

// Extracts distinct `Q<label>:` markers from our structured extraction so we
// can use the count as the denominator for the in-chat progress bar.
function countQuestions(text: string): number {
  const labels = new Set<string>();
  const re = /\bQ([0-9a-zA-Z]{1,3})\s*[:.)]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    labels.add(m[1].toLowerCase());
  }
  return labels.size;
}
