import { Accessibility, AlertTriangle, Printer, Target, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DistributionBars } from '../components/DistributionBars';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getAssessments, getAvailableYears, getClasses } from '../lib/data';
import { buildPbdSummary } from '../lib/grade';
import { TP_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { Assessment, Subject } from '../lib/types';

type EnrolmentRow = { id: string; student_id: string; class_name: string; year_level: number };
type StudentRow = { id: string; name: string; oku_status: string | null };
type PbdRow = { assessment_id: string; enrolment_id: string; subject_id: string; tp: number };
type OfferingRow = { subject_id: string; year_level: number; pbd_enabled: boolean };

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

  useEffect(() => { getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year, 'PBD')]).then(([cs, pbd]) => {
      setClasses(cs); setAssessments(pbd);
      setAssessmentId((prev) => pbd.some((a) => a.id === prev) ? prev : pbd[0]?.id || '');
      if (className !== 'ALL' && !cs.some((c) => c.className === className)) setClassName('ALL');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (assessmentId) void loadScope(); }, [year, className, assessmentId, assessments]);

  async function loadScope() {
    setLoading(true); setError('');
    try {
      let eq = supabase.from('v2_enrolments').select('id,student_id,class_name,year_level').eq('school_year', year);
      if (className !== 'ALL') eq = eq.eq('class_name', className);
      const er = await eq; if (er.error) throw er.error;
      const scope = (er.data || []) as EnrolmentRow[];
      setEnrolments(scope);
      const enrolmentIds = scope.map((e) => e.id);
      const studentIds = [...new Set(scope.map((e) => e.student_id))];
      const assessmentIds = assessments.map((a) => a.id);

      const [studentResult, currentResult, roundResult, offeringResult] = await Promise.all([
        studentIds.length ? supabase.from('v2_students').select('id,name,oku_status').in('id', studentIds) : Promise.resolve({data:[],error:null}),
        enrolmentIds.length ? supabase.from('v2_pbd_records').select('assessment_id,enrolment_id,subject_id,tp').eq('assessment_id', assessmentId).in('enrolment_id', enrolmentIds) : Promise.resolve({data:[],error:null}),
        enrolmentIds.length && assessmentIds.length ? supabase.from('v2_pbd_records').select('assessment_id,enrolment_id,subject_id,tp').in('assessment_id', assessmentIds).in('enrolment_id', enrolmentIds) : Promise.resolve({data:[],error:null}),
        supabase.from('v2_subject_offerings').select('subject_id,year_level,pbd_enabled')
      ]);
      if (studentResult.error) throw studentResult.error;
      if (currentResult.error) throw currentResult.error;
      if (roundResult.error) throw roundResult.error;
      if (offeringResult.error) throw offeringResult.error;

      const currentRows = (currentResult.data || []) as PbdRow[];
      const allRows = (roundResult.data || []) as PbdRow[];
      const subjectIds = [...new Set([...currentRows, ...allRows].map((r) => r.subject_id))];
      const subjectResult = subjectIds.length ? await supabase.from('v2_subjects').select('id,code,name_ms,name_en').in('id', subjectIds) : {data:[],error:null};
      if (subjectResult.error) throw subjectResult.error;

      setStudents((studentResult.data || []) as StudentRow[]);
      setRows(currentRows); setRoundRows(allRows);
      setSubjects((subjectResult.data || []) as Subject[]);
      setOfferings((offeringResult.data || []) as OfferingRow[]);
    } catch (e:any) {
      setError(e.message || String(e)); setEnrolments([]); setStudents([]); setRows([]); setRoundRows([]); setSubjects([]); setOfferings([]);
    } finally { setLoading(false); }
  }

  const assessment = assessments.find((a) => a.id === assessmentId);
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id,a])), [assessments]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id,s])), [subjects]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id,s])), [students]);
  const enrolmentById = useMemo(() => new Map(enrolments.map((e) => [e.id,e])), [enrolments]);

  const groups = useMemo(() => {
    const map = new Map<string,{subject:Subject;rows:PbdRow[]}>();
    rows.forEach((row) => {
      const subject = subjectById.get(row.subject_id); if (!subject) return;
      if (!map.has(subject.code)) map.set(subject.code,{subject,rows:[]});
      map.get(subject.code)!.rows.push(row);
    });
    return [...map.values()].sort((a,b) => a.subject.name_ms.localeCompare(b.subject.name_ms));
  }, [rows,subjectById]);

  useEffect(() => {
    if (!groups.length) { setSubjectCode(''); return; }
    if (!groups.some((g) => g.subject.code === subjectCode)) setSubjectCode(groups[0].subject.code);
  }, [groups,subjectCode]);

  const selected = useMemo(() => groups.find((g) => g.subject.code === subjectCode) || null,[groups,subjectCode]);
  const subject = selected?.subject || null;
  const currentRows = selected?.rows || [];
  const summary = useMemo(() => buildPbdSummary(currentRows),[currentRows]);

  const candidateEnrolments = useMemo(() => {
    if (!subject) return [];
    const enabledYears = new Set(offerings.filter((o) => o.subject_id === subject.id && o.pbd_enabled).map((o) => Number(o.year_level)));
    return enrolments.filter((e) => enabledYears.size === 0 || enabledYears.has(Number(e.year_level)));
  },[subject,offerings,enrolments]);
  const candidateCount = candidateEnrolments.length;
  const mbpkCount = useMemo(() => new Set(candidateEnrolments.filter((e) => String(studentById.get(e.student_id)?.oku_status || '').toUpperCase() === 'YA').map((e) => e.student_id)).size,[candidateEnrolments,studentById]);

  const roundTrend = useMemo(() => {
    if (!subject) return [];
    const map = new Map<string,PbdRow[]>();
    roundRows.filter((r) => r.subject_id === subject.id).forEach((r) => {
      const a = assessmentById.get(r.assessment_id); if (!a) return;
      if (!map.has(a.code)) map.set(a.code,[]); map.get(a.code)!.push(r);
    });
    return [...map.entries()].map(([code,rs]) => { const s=buildPbdSummary(rs); return {code,mtm:Number(s.mtmPct.toFixed(1)),intervention:Number(s.interventionPct.toFixed(1))}; }).sort((a,b)=>a.code.localeCompare(b.code,'ms',{numeric:true}));
  },[subject,roundRows,assessmentById]);

  const interventionRows = useMemo(() => currentRows.filter((r) => Number(r.tp) <= 2).map((r) => {
    const e = enrolmentById.get(r.enrolment_id); const s = e ? studentById.get(e.student_id) : null;
    return {id:r.enrolment_id,name:s?.name || '—',tp:r.tp};
  }).sort((a,b)=>a.tp-b.tp || a.name.localeCompare(b.name)),[currentRows,enrolmentById,studentById]);

  const items = TP_ORDER.map((tp) => ({label:tp,count:summary.tps[tp],pct:summary.total ? summary.tps[tp]/summary.total*100 : 0}));
  const classDisplay = className === 'ALL' ? 'Seluruh Sekolah' : `${classes.find((c)=>c.className===className)?.yearLevel || ''} ${formatClass(className)}`.trim();

  return <>
    <PageHeader title="Analisis PBD" actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>}/>
    <GlassCard className="filter-card no-print"><div className="filter-grid four">
      <label>Tahun<select value={year} onChange={(e)=>setYear(Number(e.target.value))}>{years.map((y)=><option key={y}>{y}</option>)}</select></label>
      <label>Pusingan PBD<select value={assessmentId} onChange={(e)=>setAssessmentId(e.target.value)}>{assessments.map((a)=><option value={a.id} key={a.id}>{a.title || a.code}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e)=>setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c)=><option key={c.className} value={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label>
      <label>Mata Pelajaran<select value={subjectCode} onChange={(e)=>setSubjectCode(e.target.value)}>{groups.map((g)=><option key={g.subject.code} value={g.subject.code}>{g.subject.name_ms}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}

    <div className="pristine-analysis-title"><div className="analysis-context"><h2>{classDisplay}<span>{subject?.name_ms || 'Pilih mata pelajaran'} · {assessment?.code || 'PBD'}</span></h2><p>SK Simpang Kuda · Tahun {year}</p></div><div className="context-rule"/></div>

    <div className="stats-grid four">
      <StatCard icon={Users} label="Bilangan Calon" value={candidateCount}/>
      <StatCard icon={Accessibility} label="MBPK" value={mbpkCount}/>
      <StatCard icon={Target} label="MTM" value={summary.mtm} hint={`${summary.mtmPct.toFixed(1)}% · TP3–TP6`} tone="amber"/>
      <StatCard icon={AlertTriangle} label="Intervensi" value={summary.intervention} hint={`${summary.interventionPct.toFixed(1)}% · TP1–TP2`} tone="red"/>
    </div>

    <div className="diagnostic-grid">
      <GlassCard className="chart-card trajectory-card"><div className="card-toolbar"><div><h2>Perbandingan Pusingan PBD</h2><p>{classDisplay} · {subject?.name_ms || ''}</p></div><div className="status-chip">{assessment?.code || 'PBD'}</div></div><div className="chart-height large">{loading ? <div className="empty-inline">Memuatkan analisis…</div> : roundTrend.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={roundTrend} margin={{top:18,right:24,bottom:8,left:2}}><CartesianGrid vertical={false}/><XAxis dataKey="code" tickLine={false} axisLine={{stroke:'#aaa89d'}}/><YAxis domain={[0,100]} tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#fffefa',border:'1px solid #c9c7bd',borderRadius:2,color:'#17191d'}}/><Bar dataKey="mtm" name="MTM %" fill="#f2c313"/><Bar dataKey="intervention" name="Intervensi %" fill="#c9363e"/></BarChart></ResponsiveContainer> : <div className="empty-inline">Tiada data pusingan.</div>}</div></GlassCard>
      <GlassCard className="target-panel"><div><h3>Rumusan PBD</h3><div className="target-number">{summary.mtm}<small> MTM</small></div></div><div className="target-meta"><div>TP3–TP6: <strong>{summary.mtmPct.toFixed(1)}%</strong></div><div style={{marginTop:8}}>TP1–TP2: <strong style={{color:'var(--red)'}}>{summary.interventionPct.toFixed(1)}%</strong></div></div></GlassCard>
    </div>

    <div className="analysis-lower-grid">
      <GlassCard className="summary-panel"><h3>Taburan Tahap Penguasaan</h3><DistributionBars items={items}/></GlassCard>
      <GlassCard className="summary-panel"><h3>Rumusan Prestasi</h3>{TP_ORDER.map((tp)=><div className="summary-row" key={tp}><span>{tp}</span><strong>{summary.tps[tp]}</strong><span>{summary.total ? (summary.tps[tp]/summary.total*100).toFixed(1) : '0.0'}%</span></div>)}</GlassCard>
      <GlassCard className="summary-panel intervention-card"><div className="intervention-body"><h3 style={{color:'var(--red)'}}>Senarai Murid Intervensi ({interventionRows.length})</h3>{interventionRows.length ? <table className="intervention-table"><thead><tr><th>Bil</th><th>Nama Murid</th><th>TP</th></tr></thead><tbody>{interventionRows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td className="score">TP{r.tp}</td></tr>)}</tbody></table> : <div className="empty-inline">Tiada murid dalam kategori intervensi.</div>}</div></GlassCard>
    </div>
  </>;
}

function formatClass(value:string){return value ? value.charAt(0)+value.slice(1).toLowerCase() : '';}
