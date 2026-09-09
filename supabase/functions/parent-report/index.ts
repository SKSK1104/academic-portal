import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { mykid } = await req.json();
    const clean = String(mykid || '').replace(/\D/g, '');
    if (clean.length !== 12) return json({ error: 'Invalid MyKid' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipHash = await sha256(caller);
    const slot = await supabase.rpc('v2_take_parent_lookup_slot', { p_hash: ipHash });
    if (slot.error) throw slot.error;
    if (!slot.data) return json({ error: 'Too many attempts' }, 429);
    const { data: student, error } = await supabase.from('v2_students').select('id,name').eq('mykid', clean).maybeSingle();
    if (error) throw error;
    if (!student) return json({ error: 'Not found' }, 404);

    const { data: enrolments, error: e2 } = await supabase.from('v2_enrolments').select('id,school_year,class_name').eq('student_id', student.id).order('school_year', { ascending: false });
    if (e2) throw e2;
    const enrolmentIds = (enrolments || []).map((e) => e.id);
    if (!enrolmentIds.length) return json({ error: 'Not found' }, 404);

    const [academicRes, pbdRes] = await Promise.all([
      supabase.from('v2_academic_marks').select('score,grade,subjects(name_ms),assessments(code,school_year),enrolment_id').in('enrolment_id', enrolmentIds),
      supabase.from('v2_pbd_records').select('tp,subjects(name_ms),assessments(code,school_year),enrolment_id').in('enrolment_id', enrolmentIds)
    ]);
    if (academicRes.error) throw academicRes.error;
    if (pbdRes.error) throw pbdRes.error;

    const latest = enrolments![0];
    return json({
      student: { name: student.name, class_name: latest.class_name, school_year: latest.school_year },
      academic: (academicRes.data || []).map((r: any) => ({ assessment: `${r.assessments?.code || ''} ${r.assessments?.school_year || ''}`.trim(), subject: r.subjects?.name_ms || '', score: r.score, grade: r.grade })),
      pbd: (pbdRes.data || []).map((r: any) => ({ assessment: `${r.assessments?.code || ''} ${r.assessments?.school_year || ''}`.trim(), subject: r.subjects?.name_ms || '', tp: r.tp }))
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
