import { Accessibility, AlertTriangle, Printer, Target, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getAssessments, getAvailableYears, getClasses } from '../lib/data';
import { buildPbdSummary } from '../lib/grade';
import { TP_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { Assessment, Subject } from '../lib/types';

type EnrolmentRow = { id: string; student_id: string; class_name: string; year_level: number };
type StudentRow = { id: string; name: string; oku_status: string | null; religion: string | null };
type PbdRow = { assessment_id: string; enrolment_id: string; subject_id: string; tp: number };
type OfferingRow = { subject_id: string; year_level: number; pbd_enabled: boolean };
type Drilldown = { tp: string; names: string[] } | null;

const TP_COLORS = ['#ff4d7d', '#ff9f43', '#ffd166', '#48e5a7', '#35c8ff', '#9b7cff'];

async function fetchPbdRowsPaged(assessmentIds: string[], enrolmentIds: string[]): Promise<PbdRow[]> {
  if (!assessmentIds.length || !enrolmentIds.length) return [];
  const all: PbdRow[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('v2_pbd_records')
      .select('assessment_id,enrolment_id,subject_id,tp')
      .in('assessment_id', assessmentIds)
      .in('enrolment_id', enrolmentIds)
      .order('assessment_id', { ascending: true })
      .order('enrolment_id', { ascending: true })
      .order('subject_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as PbdRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export function PbdAnalysisPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('ALL');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<PbdRow[]>([]);
  const [roundRows, setRoundRows] = useState<PbdRow[]>([]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  useEffect(() => {
    getAvailableYears().then((ys) => { setYears(ys); if (ys.length) setYear(ys[0]); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year, 'PBD')]).then(([cs, pbd]) => {
      setClasses(cs);
      const ordered = [...pbd].sort((a,b) => Number(a.sequence_no || 0) - Number(b.sequence_no || 0));
      setAssessments(ordered);
      setAssessmentId((prev) => ordered.some((a) => a.id === prev) ? prev : ordered[0]?.id || '');
      if (className !== 'ALL' && !cs.some((c) => c.className === className)) setClassName('ALL');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (year) void loadScope(); }, [year, className, assessmentId, assessments]);

  async function loadScope() {
    setLoading(true); setError('');
    try {
      let eq = supabase.from('v2_enrolments').select('id,student_id,class_name,year_level').eq('school_year', year).eq('is_active', true);
      if (className !== 'ALL') eq = eq.eq('class_name', className);
      const er = await eq;
      if (er.error) throw er.error;
      const scope = (er.data || []) as EnrolmentRow[];
      setEnrolments(scope);

      const enrolmentIds = scope.map((e) => e.id);
      const studentIds = [...new Set(scope.map((e) => e.student_id))];
      const assessmentIds = assessments.map((a) => a.id);

      const [studentResult, currentRowsAll, roundRowsAll, offeringResult, subjectResult] = await Promise.all([
        studentIds.length ? supabase.from('v2_students').select('id,name,oku_status,religion').in('id', studentIds) : Promise.resolve({data:[],error:null}),
        assessmentId ? fetchPbdRowsPaged([assessmentId], enrolmentIds) : Promise.resolve([] as PbdRow[]),
        fetchPbdRowsPaged(assessmentIds, enrolmentIds),
        supabase.from('v2_subject_offerings').select('subject_id,year_level,pbd_enabled'),
        supabase.from('v2_subjects').select('id,code,name_ms,name_en')
      ]);
      if (studentResult.error) throw studentResult.error;
      if (offeringResult.error) throw offeringResult.error;
      if (subjectResult.error) throw subjectResult.error;

      setStudents((studentResult.data || []) as StudentRow[]);
      setRows(currentRowsAll as PbdRow[]);
      setRoundRows(roundRowsAll as PbdRow[]);
      setOfferings((offeringResult.data || []) as OfferingRow[]);
      setSubjects((subjectResult.data || []) as Subject[]);
    } catch (e:any) {
      setError(e.message || String(e)); setEnrolments([]); setStudents([]); setRows([]); setRoundRows([]); setSubjects([]); setOfferings([]);
    } finally { setLoading(false); }
  }

  const assessment = assessments.find((a) => a.id === assessmentId);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id,s])), [students]);
  const enrolmentById = useMemo(() => new Map(enrolments.map((e) => [e.id,e])), [enrolments]);

  const availableSubjects = useMemo(() => {
    const withData = new Set(rows.map((r) => r.subject_id));
    return subjects.filter((s) => withData.has(s.id)).sort((a,b) => a.name_ms.localeCompare(b.name_ms));
  }, [subjects, rows]);

  useEffect(() => {
    if (!availableSubjects.length) { setSubjectCode(''); return; }
    if (!availableSubjects.some((s) => s.code === subjectCode)) setSubjectCode(availableSubjects[0].code);
  }, [availableSubjects, subjectCode]);

  const subject = useMemo(() => availableSubjects.find((s) => s.code === subjectCode) || null, [availableSubjects, subjectCode]);
  const currentRows = useMemo(() => subject ? rows.filter((r) => r.subject_id === subject.id) : [], [rows, subject]);
  const summary = useMemo(() => buildPbdSummary(currentRows), [currentRows]);

  const actualEnrolmentIds = useMemo(() => new Set(currentRows.map((r) => r.enrolment_id)), [currentRows]);
  const candidateCount = summary.total;
  const mtmPct = candidateCount ? summary.mtm / candidateCount * 100 : 0;
  const interventionPct = candidateCount ? summary.intervention / candidateCount * 100 : 0;
  const mbpkCount = useMemo(() => {
    const ids = new Set<string>();
    for (const enrolmentId of actualEnrolmentIds) {
      const enrolment = enrolmentById.get(enrolmentId);
      if (!enrolment) continue;
      const student = studentById.get(enrolment.student_id);
      if (String(student?.oku_status || '').toUpperCase() === 'YA') ids.add(enrolment.student_id);
    }
    return ids.size;
  }, [actualEnrolmentIds, enrolmentById, studentById]);

  const tpMembership = useMemo(() => TP_ORDER.map((tpLabel) => {
    const tp = Number(String(tpLabel).replace(/\D/g,''));
    const names = currentRows.filter((r) => Number(r.tp) === tp).map((r) => {
      const enrolment = enrolmentById.get(r.enrolment_id);
      return enrolment ? studentById.get(enrolment.student_id)?.name || '—' : '—';
    }).sort((a,b) => a.localeCompare(b));
    return { tp: tpLabel, count: names.length, names };
  }), [currentRows, enrolmentById, studentById]);

  const tpChartData = useMemo(() => tpMembership.map((x) => ({ tp:x.tp, count:x.count })), [tpMembership]);

  const roundTrend = useMemo(() => {
    if (!subject) return [];
    return assessments.map((a) => {
      const rs = roundRows.filter((r) => r.subject_id === subject.id && r.assessment_id === a.id);
      const s = buildPbdSummary(rs);
      return { code:a.code, mtm:s.mtm, intervention:s.intervention, total:s.total };
    });
  }, [subject, roundRows, assessments]);

  const interventionRows = useMemo(() => currentRows.filter((r) => Number(r.tp) <= 2).map((r) => {
    const e = enrolmentById.get(r.enrolment_id); const s = e ? studentById.get(e.student_id) : null;
    return {id:r.enrolment_id,name:s?.name || '—',tp:r.tp};
  }).sort((a,b)=>a.tp-b.tp || a.name.localeCompare(b.name)),[currentRows,enrolmentById,studentById]);

  const classDisplay = className === 'ALL' ? 'Seluruh Sekolah' : `${classes.find((c)=>c.className===className)?.yearLevel || ''} ${formatClass(className)}`.trim();
  const hasPbd = assessments.length > 0;

  return <>
    <PageHeader title="Analisis PBD" actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>}/>
    <GlassCard className="filter-card no-print"><div className="filter-grid four">
      <label>Tahun<select value={year} onChange={(e)=>setYear(Number(e.target.value))}>{years.map((y)=><option key={y}>{y}</option>)}</select></label>
      <label>Pusingan PBD<select value={assessmentId} onChange={(e)=>setAssessmentId(e.target.value)} disabled={!hasPbd}>{hasPbd ? assessments.map((a)=><option value={a.id} key={a.id}>{a.code}</option>) : <option>Tiada PBD</option>}</select></label>
      <label>Kelas<select value={className} onChange={(e)=>setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c)=><option key={c.className} value={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label>
      <label>Mata Pelajaran<select value={subjectCode} onChange={(e)=>setSubjectCode(e.target.value)} disabled={!availableSubjects.length}>{availableSubjects.length ? availableSubjects.map((s)=><option key={s.code} value={s.code}>{s.name_ms}</option>) : <option>Tiada data</option>}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}

    <div className="pristine-analysis-title"><div className="analysis-context"><h2>{classDisplay}<span>{subject?.name_ms || 'PBD'} · {assessment?.code || 'Belum diimport'}</span></h2><p>SK Simpang Kuda · Tahun {year}</p></div><div className="context-rule"/></div>

    {!hasPbd ? <GlassCard className="pbd-empty-state premium-card"><strong>Belum ada data PBD untuk {year}</strong><span>Import fail PBD individu melalui Import Data.</span></GlassCard> : <>
      <div className="stats-grid four">
        <StatCard icon={Users} label="Bilangan Calon" value={candidateCount} hint="Jumlah rekod TP"/>
        <StatCard icon={Accessibility} label="MBPK" value={mbpkCount}/>
        <StatCard icon={Target} label="MTM" value={summary.mtm} hint={`${mtmPct.toFixed(1)}% · TP3–TP6`} tone="amber"/>
        <StatCard icon={AlertTriangle} label="Intervensi" value={summary.intervention} hint={`${interventionPct.toFixed(1)}% · TP1–TP2`} tone="red"/>
      </div>

      <div className="pbd-primary-grid">
        <div className="pbd-stack">
          <GlassCard className="chart-card premium-card pbd-distribution-card">
            <div className="card-toolbar"><div><h2>Taburan Tahap Penguasaan</h2><p>{assessment?.code} · {subject?.name_ms || ''}</p></div><span className="status-chip">Klik bar untuk nama murid</span></div>
            <div className="pbd-chart-height">{loading ? <div className="empty-inline">Memuatkan analisis…</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={tpChartData} margin={{top:48,right:24,bottom:14,left:8}} barCategoryGap="28%"><CartesianGrid vertical={false}/><XAxis dataKey="tp" tickLine={false} axisLine={{stroke:'#6f86a2'}} tick={{fontSize:17,fontWeight:900}}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:14}}/><Tooltip cursor={false} formatter={(v) => [`${v} murid`, 'Bilangan']} contentStyle={{background:'rgba(5,14,31,.96)',border:'1px solid rgba(89,184,255,.34)',borderRadius:14,fontSize:14,color:'#fff',boxShadow:'0 18px 48px rgba(0,0,0,.42)'}}/><Bar dataKey="count" radius={[8,8,0,0]} cursor="pointer" activeBar={false} onClick={(data:any) => { const tp=String(data?.payload?.tp || data?.tp || ''); const found=tpMembership.find((x)=>x.tp===tp); if(found) setDrilldown({tp,names:found.names}); }}>{tpChartData.map((entry, index)=><Cell key={entry.tp} fill={TP_COLORS[index % TP_COLORS.length]}/>) }<LabelList dataKey="count" position="top" className="pbd-bar-label"/></Bar></BarChart></ResponsiveContainer>}</div>
          </GlassCard>

          <GlassCard className="summary-panel intervention-card premium-card"><div className="intervention-body"><h3>Senarai Murid Memerlukan Intervensi ({interventionRows.length})</h3>{interventionRows.length ? <table className="intervention-table"><thead><tr><th>Bil</th><th>Nama Murid</th><th>TP</th></tr></thead><tbody>{interventionRows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td className="score">TP{r.tp}</td></tr>)}</tbody></table> : <div className="empty-inline">Tiada murid dalam kategori intervensi.</div>}</div></GlassCard>
        </div>

        <GlassCard className="target-panel premium-card pbd-rumusan-card"><div><h3>Rumusan PBD</h3><div className="target-number">{summary.mtm}<small> MTM</small></div></div><div className="target-meta"><div>Calon: <strong>{candidateCount}</strong></div><div style={{marginTop:8}}>TP1–TP6: <strong>{candidateCount}</strong></div><div style={{marginTop:8}}>TP3–TP6: <strong>{mtmPct.toFixed(1)}%</strong></div><div style={{marginTop:8}}>TP1–TP2: <strong style={{color:'var(--red)'}}>{interventionPct.toFixed(1)}%</strong></div></div></GlassCard>
      </div>

      {assessments.length > 1 && <GlassCard className="summary-panel premium-card pbd-round-card"><div className="card-toolbar"><div><h2>Perbandingan Pusingan PBD</h2><p>Bilangan murid</p></div><span className="status-chip">{classDisplay}</span></div><div className="pbd-round-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={roundTrend} margin={{top:42,right:24,bottom:10,left:8}} barGap={10}><CartesianGrid vertical={false}/><XAxis dataKey="code" tickLine={false} axisLine={{stroke:'#6f86a2'}} tick={{fontSize:16,fontWeight:800}}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip cursor={false} contentStyle={{background:'rgba(5,14,31,.96)',border:'1px solid rgba(89,184,255,.34)',borderRadius:14,fontSize:14,color:'#fff',boxShadow:'0 18px 48px rgba(0,0,0,.42)'}}/><Legend wrapperStyle={{fontSize:14,fontWeight:800}}/><Bar dataKey="mtm" name="MTM" fill="#2ae6b5" radius={[6,6,0,0]} activeBar={false}><LabelList dataKey="mtm" position="top" className="pbd-bar-label"/></Bar><Bar dataKey="intervention" name="Intervensi" fill="#ff5f8f" radius={[6,6,0,0]} activeBar={false}><LabelList dataKey="intervention" position="top" className="pbd-bar-label"/></Bar></BarChart></ResponsiveContainer></div></GlassCard>}

      <GlassCard className="summary-panel premium-card pbd-membership-card"><div className="card-toolbar"><div><h2>Senarai Murid Mengikut Tahap Penguasaan</h2></div><span className="status-chip">Cetakan lengkap</span></div><div className="pbd-membership-scroll"><table className="data-table pbd-membership-table"><thead><tr><th>TP</th><th>Bilangan</th><th>Nama Murid</th></tr></thead><tbody>{tpMembership.map((r)=><tr key={r.tp}><td><strong>{r.tp}</strong></td><td><strong>{r.count}</strong></td><td>{r.names.length ? r.names.join(', ') : <span className="muted-cell">Tiada murid</span>}</td></tr>)}</tbody></table></div></GlassCard>
    </>}

    {drilldown && <div className="grade-modal-backdrop no-print" role="dialog" aria-modal="true" onMouseDown={(e)=>{if(e.currentTarget===e.target)setDrilldown(null)}}><div className="grade-modal"><div className="grade-modal-head"><div><span>{assessment?.code || 'PBD'}</span><h2>{drilldown.tp}</h2></div><button className="icon-button" onClick={()=>setDrilldown(null)} aria-label="Tutup"><X size={18}/></button></div><div className="grade-modal-count">{drilldown.names.length} murid</div>{drilldown.names.length ? <ol className="grade-modal-list">{drilldown.names.map((name)=><li key={name}>{name}</li>)}</ol> : <div className="empty-inline">Tiada murid.</div>}</div></div>}
  </>;
}

function formatClass(value:string){return value ? value.charAt(0)+value.slice(1).toLowerCase() : '';}
