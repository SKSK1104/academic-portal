import { CloudUpload, Save, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { getAssessments, getAvailableYears, getClasses, getSubjectsForYear } from '../lib/data';
import { gradeFromScore } from '../lib/grade';
import { supabase } from '../lib/supabase';
import type { Assessment, Subject } from '../lib/types';

interface EntryRow {
  enrolmentId: string;
  studentId: string;
  name: string;
  tov: string;
  etr: string;
  scores: Record<string, string>;
}

export function MarkEntryPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedClass = useMemo(() => classes.find((x) => x.className === className), [classes, className]);
  const classLabel = selectedClass ? `${selectedClass.yearLevel} ${formatClass(selectedClass.className)}` : className;
  const orderedAssessments = useMemo(() => [...assessments].sort((a, b) => Number(a.sequence_no || 0) - Number(b.sequence_no || 0)), [assessments]);

  useEffect(() => {
    getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year, 'AR')]).then(([cs, ars]) => {
      setClasses(cs);
      setClassName((current) => cs.some((x) => x.className === current) ? current : (cs[0]?.className || ''));
      setAssessments(ars);
    }).catch((e) => setMessage(e.message));
  }, [year]);

  useEffect(() => {
    if (!selectedClass) return;
    getSubjectsForYear(selectedClass.yearLevel, 'AR').then((subs) => {
      setSubjects(subs);
      setSubjectId((current) => subs.some((s) => s.id === current) ? current : (subs[0]?.id || ''));
    }).catch((e) => setMessage(e.message));
  }, [selectedClass]);

  useEffect(() => {
    if (!className || !subjectId || !orderedAssessments.length) { setRows([]); return; }
    void loadRows();
  }, [className, subjectId, orderedAssessments, year]);

  async function loadRows() {
    setLoading(true); setMessage('');
    try {
      const { data: enrolments, error: e1 } = await supabase
        .from('v2_enrolments')
        .select('id,student_id,students:v2_students!v2_enrolments_student_id_fkey(id,name)')
        .eq('school_year', year)
        .eq('class_name', className)
        .eq('is_active', true);
      if (e1) throw e1;
      const ids = (enrolments || []).map((x: any) => x.id);
      if (!ids.length) { setRows([]); return; }

      const assessmentIds = orderedAssessments.map((a) => a.id);
      const [{ data: benchmarks, error: e2 }, { data: marks, error: e3 }] = await Promise.all([
        supabase.from('v2_academic_benchmarks').select('enrolment_id,tov,etr').eq('subject_id', subjectId).in('enrolment_id', ids),
        supabase.from('v2_academic_marks').select('assessment_id,enrolment_id,score,grade').eq('subject_id', subjectId).in('assessment_id', assessmentIds).in('enrolment_id', ids)
      ]);
      if (e2) throw e2; if (e3) throw e3;

      const benchmarkByEnrolment = new Map((benchmarks || []).map((x: any) => [x.enrolment_id, x]));
      const scoreByKey = new Map((marks || []).map((x: any) => [`${x.enrolment_id}|${x.assessment_id}`, x]));
      setRows((enrolments || []).map((x: any) => {
        const scores: Record<string, string> = {};
        orderedAssessments.forEach((a) => {
          const mark = scoreByKey.get(`${x.id}|${a.id}`) as any;
          scores[a.id] = mark?.score === null || mark?.score === undefined ? '' : String(mark.score);
        });
        return {
          enrolmentId: x.id,
          studentId: x.student_id,
          name: x.students?.name || '—',
          tov: benchmarkByEnrolment.get(x.id)?.tov ?? '',
          etr: benchmarkByEnrolment.get(x.id)?.etr ?? '',
          scores
        };
      }).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setLoading(false); }
  }

  function cleanScore(value: string) {
    return value === '' ? '' : String(Math.max(0, Math.min(100, Number(value))));
  }

  function updateBenchmark(index: number, key: 'tov' | 'etr', value: string) {
    const clean = cleanScore(value);
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, [key]: clean } : row));
  }

  function updateAr(index: number, assessmentId: string, value: string) {
    const clean = cleanScore(value);
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, scores: { ...row.scores, [assessmentId]: clean } } : row));
  }

  async function save() {
    if (!subjectId || !orderedAssessments.length) return;
    setSaving(true); setMessage('');
    try {
      const now = new Date().toISOString();
      const benchmarkPayload = rows.map((r) => ({
        enrolment_id: r.enrolmentId,
        subject_id: subjectId,
        tov: r.tov === '' ? null : Number(r.tov),
        etr: r.etr === '' ? null : Number(r.etr),
        updated_at: now
      }));
      const markPayload = rows.flatMap((r) => orderedAssessments.map((a) => {
        const raw = r.scores[a.id] ?? '';
        const score = raw === '' ? null : Number(raw);
        return {
          enrolment_id: r.enrolmentId,
          subject_id: subjectId,
          assessment_id: a.id,
          score,
          grade: score === null ? 'TH' : gradeFromScore(score),
          source: 'manual',
          updated_at: now
        };
      }));
      const [b, m] = await Promise.all([
        supabase.from('v2_academic_benchmarks').upsert(benchmarkPayload, { onConflict: 'enrolment_id,subject_id' }),
        supabase.from('v2_academic_marks').upsert(markPayload, { onConflict: 'assessment_id,enrolment_id,subject_id' })
      ]);
      if (b.error) throw b.error; if (m.error) throw m.error;
      setMessage('Markah berjaya disimpan.');
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setSaving(false); }
  }

  return <>
    <style>{`
      .ar-entry-scroll{overflow:auto!important;-webkit-overflow-scrolling:touch;position:relative}
      .ar-round-table{width:max-content!important;min-width:100%!important;border-collapse:separate!important;border-spacing:0!important}
      .ar-round-table th,.ar-round-table td{white-space:nowrap!important}
      .ar-round-table th:first-child,.ar-round-table td:first-child{width:48px!important;min-width:48px!important;max-width:48px!important;text-align:center!important}
      .ar-round-table .student-name,.ar-round-table th:nth-child(2){min-width:250px!important;max-width:250px!important;width:250px!important;white-space:normal!important;line-height:1.25!important}
      .ar-round-table input{width:72px!important;min-width:72px!important;text-align:center!important}
      @media(max-width:780px){
        .ar-entry-card{overflow:visible!important}
        .ar-entry-scroll{max-height:none!important;border-radius:0 0 18px 18px!important}
        .ar-round-table th:first-child,.ar-round-table td:first-child{position:sticky!important;left:0!important;z-index:8!important;background:#071a30!important;box-shadow:1px 0 0 rgba(130,205,255,.18)!important}
        .ar-round-table th:nth-child(2),.ar-round-table td:nth-child(2){position:sticky!important;left:48px!important;z-index:7!important;background:#081d35!important;box-shadow:10px 0 20px rgba(0,0,0,.28),1px 0 0 rgba(130,205,255,.24)!important}
        .ar-round-table thead th:first-child,.ar-round-table thead th:nth-child(2){z-index:12!important;background:#0b2744!important}
        .ar-round-table .student-name,.ar-round-table th:nth-child(2){min-width:190px!important;max-width:190px!important;width:190px!important;font-size:12px!important;font-weight:800!important;color:#fff!important}
        .ar-round-table td{height:58px!important}
        .ar-round-table th{height:46px!important}
        .ar-round-table input{width:66px!important;min-width:66px!important;height:38px!important;padding:7px 6px!important;font-size:15px!important}
        .ar-round-table .grade-badge{margin-left:0!important}
      }
    `}</style>
    <PageHeader title="Pengisian AR" actions={<button className="btn btn-primary" onClick={save} disabled={saving || !rows.length}><CloudUpload size={16}/>{saving ? 'Menyimpan...' : 'Simpan'}</button>} />

    <GlassCard className="filter-card">
      <div className="filter-grid three">
        <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
        <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}>{classes.map((x) => <option key={x.className} value={x.className}>{x.yearLevel} {formatClass(x.className)}</option>)}</select></label>
        <label>Mata Pelajaran<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option value={s.id} key={s.id}>{s.name_ms}</option>)}</select></label>
      </div>
    </GlassCard>

    <GlassCard className="table-card ar-entry-card">
      <div className="card-toolbar"><div><h2>{classLabel}</h2><p>{subjects.find((s) => s.id === subjectId)?.name_ms || 'Pilih mata pelajaran'}</p></div><div className="status-chip"><Users size={15}/>{rows.length} murid</div></div>
      {message && <div className={message.includes('berjaya') ? 'notice success' : 'notice'}>{message}</div>}
      <div className="table-scroll ar-entry-scroll">
        <table className="data-table mark-table ar-round-table"><thead><tr><th>Bil</th><th>Nama Murid</th><th>TOV</th><th>Gred</th>{orderedAssessments.map((a) => <><th key={`${a.id}-score`}>{a.code}</th><th key={`${a.id}-grade`}>Gred</th></>)}<th>ETR</th><th>Gred</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6 + orderedAssessments.length * 2}>Memuatkan...</td></tr> : rows.map((r, i) => <tr key={r.enrolmentId}><td>{i + 1}</td><td className="student-name">{r.name}</td>
            <td><input type="number" min="0" max="100" value={r.tov} onChange={(e) => updateBenchmark(i, 'tov', e.target.value)}/></td>
            <td>{gradeBadge(r.tov)}</td>
            {orderedAssessments.map((a) => <><td key={`${r.enrolmentId}-${a.id}-score`}><input type="number" min="0" max="100" value={r.scores[a.id] ?? ''} onChange={(e) => updateAr(i, a.id, e.target.value)}/></td><td key={`${r.enrolmentId}-${a.id}-grade`}>{gradeBadge(r.scores[a.id] ?? '')}</td></>)}
            <td><input type="number" min="0" max="100" value={r.etr} onChange={(e) => updateBenchmark(i, 'etr', e.target.value)}/></td>
            <td>{gradeBadge(r.etr)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="table-footer"><button className="btn btn-primary" onClick={save} disabled={saving || !rows.length}><Save size={16}/> Simpan Perubahan</button></div>
    </GlassCard>
  </>;
}

function gradeBadge(value: string) {
  if (value === '') return <span className="grade-badge grade-TH">—</span>;
  const grade = gradeFromScore(Number(value));
  return <span className={`grade-badge grade-${grade}`}>{grade}</span>;
}
function formatClass(value: string) { return value ? value.charAt(0) + value.slice(1).toLowerCase() : ''; }
