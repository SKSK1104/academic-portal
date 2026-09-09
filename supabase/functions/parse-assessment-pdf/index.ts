import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'Unauthorized' }, 401);

    const { storagePath, requestedKind = 'AUTO' } = await req.json();
    if (!storagePath) return json({ error: 'storagePath required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const download = await admin.storage.from('assessment-imports').download(storagePath);
    if (download.error || !download.data) throw download.error || new Error('PDF not found');

    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const base64 = toBase64(bytes);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured for PDF parsing.' }, 500);

    const model = Deno.env.get('OPENAI_PARSER_MODEL') || 'gpt-5';
    const prompt = buildPrompt(requestedKind);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', filename: storagePath.split('/').pop() || 'assessment.pdf', file_data: base64 }
          ]
        }]
      })
    });
    const raw = await response.json();
    if (!response.ok) throw new Error(raw?.error?.message || 'Parser provider error');
    const outputText = extractOutputText(raw);
    const parsed = JSON.parse(stripFences(outputText));
    return json(parsed, 200);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function buildPrompt(requestedKind: string) {
  return `You are parsing official Malaysian primary-school assessment PDFs for SK Simpang Kuda. The PDF layout is consistent. Return ONLY valid JSON, no markdown.

Requested hint: ${requestedKind}.

Detect one doc_type:
- UASA_INDIVIDUAL: one row per pupil; columns include name, MyKid/No. Pengenalan, gender and subject grades A-F (often BM, BI, Matematik, Sains, Sejarah, PAI/PM, Bahasa Iban, RBT, Seni Visual, Pendidikan Muzik, PJPK).
- PBD_INDIVIDUAL: one row per pupil; same identity columns, subject values TP1-TP6.
- PBD_SUMMARY: class-level subject rows with counts for TP1, TP2, TP3, TP4, TP5, TP6 and total.
- UNKNOWN otherwise.

Use exactly this JSON shape:
{
  "doc_type":"PBD_INDIVIDUAL|PBD_SUMMARY|UASA_INDIVIDUAL|UNKNOWN",
  "school_name":string|null,
  "school_year":number|null,
  "year_level":number|null,
  "class_name":string|null,
  "activity":string|null,
  "class_teacher":string|null,
  "subjects":[{"label":string,"code_hint":string|null}],
  "rows":[{"student_name":string,"mykid":string|null,"gender":string|null,"values":{"<subject label>":"A|B|C|D|E|F|TH|TP1|TP2|TP3|TP4|TP5|TP6|null"}}],
  "summary":[{"subject_label":string,"TP1":number,"TP2":number,"TP3":number,"TP4":number,"TP5":number,"TP6":number,"total":number}],
  "warnings":[string]
}

Rules:
1. Preserve pupil names exactly as printed, uppercase is fine.
2. MyKid must contain digits only.
3. Do not invent missing values. Use null and add a warning.
4. PAI/PM may remain the label "PAI/PM". The portal maps it to Pendidikan Islam or Pendidikan Moral using the roster religion field.
5. For UASA, do not convert grades to approximate scores.
6. For PBD, values must be TP1-TP6 only.
7. Read all pages. Do not stop after page 1.
8. For PBD_SUMMARY, rows should be empty and summary populated. For individual PDFs, summary may be empty.`;
}

function extractOutputText(raw: any): string {
  const parts: string[] = [];
  for (const item of raw?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (!parts.length && typeof raw?.output_text === 'string') return raw.output_text;
  return parts.join('\n');
}

function stripFences(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}
function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
