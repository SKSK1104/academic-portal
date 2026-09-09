import { CloudUpload, Plus, Save, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { createNextAr, getAssessments, getAvailableYears, getClasses, getSubjectsForYear } from '../lib/data';
import { gradeFromScore } from '../lib/grade';
import { supabase } from '../lib/supabase';
import type { Assessment, Subject } from '../lib/types';

interface EntryRow {
  enrolmentId: string;
  studentId: string;
  name: string;
  tov: string;
  score: string;
  etr: string;
}

export function MarkEntryPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedClass = useMemo(() => classes.find((x) => x.className === className), [classes, className]);
  const selectedAssessment = useMemo(() => assessments.find((x) => x.id === assessmentId), [assessments, assessmentId]);

  useEffect(() => {
    getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year, 'AR')]).then(([cs, ars]) => {
      setClasses(cs); setClassName(cs[0]?.className || '');
      setAssessments(ars); setAssessmentId(ars[0]?.id || '');
    }).catch((e) => setMessage(e.message));
  }, [year]);

  useEffect(() => {
    if (!selectedClass) return;
    getSubjectsForYear(selectedClass.yearLevel, 'AR').then((subs) => {
      setSubjects(subs); setSubjectId(subs[0]?.id || '');
    }).catch((e) => setMessage(e.message));
  }, [selectedClass]);

  useEffect(() => {
    if (!className || !subjectId || !assessmentId) { setRows([]); return; }
    void loadRows();
  }, [className, subjectId, assessmentId]);

  async function loadRows() {
    setLoading(true); setMessage('');
    try {
      const { data: enrolments, error: e1 } = await supabase
        .from('v2_enrolments')
        .select('id,student_id,students(id,name)')
        .eq('school_year', year)
        .eq('class_name', className);
      if (e1) throw e1;
      const ids = (enrolments || []).map((x: any) => x.id);
      if (!ids.length) { setRows([]); return; }

      const [{ data: benchmarks, error: e2 }, { data: marks, error: e3 }] = await Promise.all([
        supabase.from('v2_academic_benchmarks').select('enrolment_id,tov,etr').eq('subject_id', subjectId).in('enrolment_id', ids),
        supabase.from('v2_academic_marks').select('enrolment_id,score').eq('subject_id', subjectId).eq('assessment_id', assessmentId).in('enrolment_id', ids)
      ]);
      if (e2) throw e2; if (e3) throw e3;
      const b = new Map((benchmarks || []).map((x: any) => [x.enrolment_id, x]));
      const m = new Map((marks || []).map((x: any) => [x.enrolment_id, x]));
      setRows((enrolments || []).map((x: any) => ({
        enrolmentId: x.id,
        studentId: x.student_id,
        name: x.students?.name || '—',
        tov: b.get(x.id)?.tov ?? '',
        score: m.get(x.id)?.score ?? '',
        etr: b.get(x.id)?.etr ?? ''
      })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setLoading(false); }
  }

  function updateRow(index: number, key: 'tov' | 'score' | 'etr', value: string) {
    const clean = value === '' ? '' : String(Math.max(0, Math.min(100, Number(value))));
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, [key]: clean } : row));
  }

  async function save() {
    if (!subjectId || !assessmentId) return;
    setSaving(true); setMessage('');
    try {
      const benchmarkPayload = rows.map((r) => ({
        enrolment_id: r.enrolmentId,
        subject_id: subjectId,
        tov: r.tov === '' ? null : Number(r.tov),
        etr: r.etr === '' ? null : Number(r.etr),
        updated_at: new Date().toISOString()
      }));
      const markPayload = rows.map((r) => {
        const score = r.score === '' ? null : Number(r.score);
        return {
          enrolment_id: r.enrolmentId,
          subject_id: subjectId,
          assessment_id: assessmentId,
          score,
          grade: score === null ? 'TH' : gradeFromScore(score),
          source: 'manual',
          updated_at: new Date().toISOString()
        };
      });
      const [b, m] = await Promise.all([
        supabase.from('v2_academic_benchmarks').upsert(benchmarkPayload, { onConflict: 'enrolment_id,subject_id' }),
        supabase.from('v2_academic_marks').upsert(markPayload, { onConflict: 'assessment_id,enrolment_id,subject_id' })
      ]);
      if (b.error) throw b.error; if (m.error) throw m.error;
      setMessage('Markah berjaya disimpan.');
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setSaving(false); }
  }

  async function addAr() {
    try {
      const next = await createNextAr(year);
      const ars = await getAssessments(year, 'AR');
      setAssessments(ars); setAssessmentId(next.id);
    } catch (e: any) { setMessage(e.message || String(e)); }
  }

  return <>
    <PageHeader eyebrow="DATA ENTRY" title="Pengisian AR" description="Hanya TOV, markah AR semasa dan ETR. UASA diimport melalui PDF." actions={<button className="btn btn-success" onClick={save} disabled={saving || !rows.length}><CloudUpload size={16}/>{saving ? 'Menyimpan...' : 'Simpan'}</button>} />

    <GlassCard className="filter-card">
      <div className="filter-grid four">
        <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
        <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}>{classes.map((x) => <option key={x.className}>{x.className}</option>)}</select></label>
        <label>Pentaksiran<div className="inline-control"><select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{assessments.map((a) => <option value={a.id} key={a.id}>{a.code}</option>)}</select><button className="icon-button" title="Tambah AR baru" onClick={addAr}><Plus size={17}/></button></div></label>
        <label>Mata Pelajaran<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option value={s.id} key={s.id}>{s.name_ms}</option>)}</select></label>
      </div>
    </GlassCard>

    <GlassCard className="table-card">
      <div className="card-toolbar"><div><h2>{selectedAssessment?.code || 'AR'} • {className}</h2><p>{subjects.find((s) => s.id === subjectId)?.name_ms || 'Pilih mata pelajaran'}</p></div><div className="status-chip"><Users size={15}/>{rows.length} murid</div></div>
      {message && <div className={message.includes('berjaya') ? 'notice success' : 'notice'}>{message}</div>}
      <div className="table-scroll">
        <table className="data-table mark-table"><thead><tr><th>Bil</th><th>Nama Murid</th><th>TOV</th><th>{selectedAssessment?.code || 'AR'}</th><th>ETR</th><th>Gred</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6}>Memuatkan...</td></tr> : rows.map((r, i) => <tr key={r.enrolmentId}><td>{i + 1}</td><td className="student-name">{r.name}</td>
            <td><input type="number" min="0" max="100" value={r.tov} onChange={(e) => updateRow(i, 'tov', e.target.value)}/></td>
            <td><input type="number" min="0" max="100" value={r.score} onChange={(e) => updateRow(i, 'score', e.target.value)}/></td>
            <td><input type="number" min="0" max="100" value={r.etr} onChange={(e) => updateRow(i, 'etr', e.target.value)}/></td>
            <td><span className={`grade-badge grade-${r.score === '' ? 'TH' : gradeFromScore(Number(r.score))}`}>{r.score === '' ? 'TH' : gradeFromScore(Number(r.score))}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="table-footer"><button className="btn btn-primary" onClick={save} disabled={saving || !rows.length}><Save size={16}/> Simpan Perubahan</button></div>
    </GlassCard>
  </>;
}
