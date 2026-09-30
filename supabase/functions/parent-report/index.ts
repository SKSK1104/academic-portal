import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const clean = String(body?.mykid || '').replace(/\D/g, '');
    if (clean.length !== 12) return json({ error: 'Invalid MyKid' }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipHash = await sha256(caller);
    const slot = await db.rpc('v2_take_parent_lookup_slot', { p_hash: ipHash });
    if (slot.error) throw slot.error;
    if (!slot.data) return json({ error: 'Too many attempts' }, 429);

    const { data: student, error: studentError } = await db
      .from('v2_students')
      .select('id,student_id,name,mykid')
      .eq('mykid', clean)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) return json({ error: 'Not found' }, 404);

    const { data: enrolments, error: enrolError } = await db
      .from('v2_enrolments')
      .select('id,school_year,year_level,class_name,is_active')
      .eq('student_id', student.id)
      .order('school_year', { ascending: false });
    if (enrolError) throw enrolError;
    if (!enrolments?.length) return json({ error: 'Not found' }, 404);

    const enrolmentIds = enrolments.map((e:any) => e.id);
    const latest = enrolments.find((e:any) => e.is_active) || enrolments[0];

    const [{ data: marks, error: marksError }, { data: pbdRows, error: pbdError }] = await Promise.all([
      db.from('v2_academic_marks').select('assessment_id,enrolment_id,subject_id,score,grade').in('enrolment_id', enrolmentIds),
      db.from('v2_pbd_records').select('assessment_id,enrolment_id,subject_id,tp').in('enrolment_id', enrolmentIds),
    ]);
    if (marksError) throw marksError;
    if (pbdError) throw pbdError;

    const subjectIds = [...new Set([...(marks || []).map((r:any) => r.subject_id), ...(pbdRows || []).map((r:any) => r.subject_id)])];
    const assessmentIds = [...new Set([...(marks || []).map((r:any) => r.assessment_id), ...(pbdRows || []).map((r:any) => r.assessment_id)])];

    const [{ data: subjects, error: subjectsError }, { data: assessments, error: assessmentsError }] = await Promise.all([
      subjectIds.length ? db.from('v2_subjects').select('id,code,name_ms').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
      assessmentIds.length ? db.from('v2_assessments').select('id,code,title,school_year,kind,sequence_no').in('id', assessmentIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (subjectsError) throw subjectsError;
    if (assessmentsError) throw assessmentsError;

    const subjectMap = new Map((subjects || []).map((s:any) => [s.id, s]));
    const assessmentMap = new Map((assessments || []).map((a:any) => [a.id, a]));
    const enrolmentMap = new Map((enrolments || []).map((e:any) => [e.id, e]));

    const academic = (marks || []).map((r:any) => {
      const a:any = assessmentMap.get(r.assessment_id);
      const s:any = subjectMap.get(r.subject_id);
      const e:any = enrolmentMap.get(r.enrolment_id);
      return {
        assessment: a?.code || '', assessment_title: a?.title || a?.code || '', assessment_kind: a?.kind || '', sequence_no: a?.sequence_no ?? null,
        school_year: a?.school_year ?? e?.school_year ?? null, subject_code: s?.code || '', subject: s?.name_ms || '', score: r.score, grade: r.grade
      };
    }).filter((r:any) => r.assessment && r.subject);

    const pbd = (pbdRows || []).map((r:any) => {
      const a:any = assessmentMap.get(r.assessment_id);
      const s:any = subjectMap.get(r.subject_id);
      const e:any = enrolmentMap.get(r.enrolment_id);
      return {
        assessment: a?.code || '', assessment_title: a?.title || a?.code || '', sequence_no: a?.sequence_no ?? null,
        school_year: a?.school_year ?? e?.school_year ?? null, subject_code: s?.code || '', subject: s?.name_ms || '', tp: r.tp
      };
    }).filter((r:any) => r.assessment && r.subject);

    // Pentaksiran Psikometrik (optional): only the child's own profile, without
    // name or MyKid. If this lookup fails, the rest of the report is unaffected.
    let psychometric: any[] = [];
    try {
      const { data: psyRows, error: psyError } = await db
        .from('v2_intelligence_profiles')
        .select('school_year,profile')
        .in('enrolment_id', enrolmentIds);
      if (!psyError) {
        psychometric = (psyRows || []).map((r:any) => {
          const p = r.profile || {};
          return {
            school_year: r.school_year, format: p.format, year_level: p.year_level, class_name: p.class_name,
            scores: p.scores ?? null, dominant: p.dominant ?? null, bahagian_b: p.bahagian_b ?? null, aptitude: p.aptitude ?? null,
          };
        }).filter((r:any) => r.format);
      }
    } catch (_) { psychometric = []; }

    academic.sort((x:any,y:any) => Number(x.school_year)-Number(y.school_year) || Number(x.sequence_no||0)-Number(y.sequence_no||0) || x.subject.localeCompare(y.subject));
    pbd.sort((x:any,y:any) => Number(x.school_year)-Number(y.school_year) || Number(x.sequence_no||0)-Number(y.sequence_no||0) || x.subject.localeCompare(y.subject));

    return json({
      student: {
        name: student.name,
        student_id: student.student_id,
        class_name: latest.class_name,
        year_level: latest.year_level,
        school_year: latest.school_year,
      },
      academic,
      pbd,
      psychometric,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
