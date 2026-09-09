import { Accessibility, AlertTriangle, Printer, Target, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DistributionBars } from '../components/DistributionBars';
import { GlassCard } from '../components/GlassCard';
import { InterventionPanel } from '../components/InterventionPanel';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getAssessments, getAvailableYears, getClasses } from '../lib/data';
import { buildAcademicSummary } from '../lib/grade';
import { GRADE_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { Assessment } from '../lib/types';

interface MarkRow {
  enrolment_id: string;
  score: number | null;
  grade: string | null;
  subject_id: string;
  subjects: { code: string; name_ms: string } | null;
  enrolments: { class_name: string; students: { name: string; oku_status: string | null } | null } | null;
  assessments: { code: string; kind: string; sequence_no: number | null; school_year?: number } | null;
}
interface BenchmarkRow { enrolment_id: string; subject_id: string; tov: number | null; etr: number | null; }

export function AcademicAnalysisPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('ALL');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [trendRows, setTrendRows] = useState<MarkRow[]>([]);
  const [yearlyRows, setYearlyRows] = useState<MarkRow[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch(console.error); }, []);
  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year)]).then(([cs, ass]) => {
      setClasses(cs);
      const academic = ass.filter((a) => a.kind === 'AR' || a.kind === 'UASA');
      setAssessments(academic);
      const preferred = academic.find((a) => a.kind === 'AR') || academic.find((a) => a.kind === 'UASA');
      setAssessmentId(preferred?.id || '');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (assessmentId) void load(); }, [year, assessmentId, className]);

  async function load() {
    setLoading(true); setError('');
    try {
      const baseSelect = 'enrolment_id,score,grade,subject_id,subjects:v2_subjects!v2_academic_marks_subject_id_fkey(code,name_ms),enrolments:v2_enrolments!v2_academic_marks_enrolment_id_fkey(class_name,students:v2_students!v2_enrolments_student_id_fkey(name,oku_status)),assessments:v2_assessments!v2_academic_marks_assessment_id_fkey(code,kind,sequence_no,school_year)';
      let q = supabase.from('v2_academic_marks').select(baseSelect).eq('assessment_id', assessmentId);
      if (className !== 'ALL') q = q.eq('enrolments.class_name', className);
      const current = await q; if (current.error) throw current.error;
      const currentRows = (current.data || []) as any as MarkRow[];
      setRows(currentRows);

      let tq = supabase.from('v2_academic_marks').select(baseSelect).eq('assessments.school_year', year);
      if (className !== 'ALL') tq = tq.eq('enrolments.class_name', className);
      const tr = await tq; if (tr.error) throw tr.error;
      setTrendRows((tr.data || []) as any as MarkRow[]);

      const code = assessments.find((a) => a.id === assessmentId)?.code;
      if (code) {
        let yq = supabase.from('v2_academic_marks').select(baseSelect).eq('assessments.code', code);
        if (className !== 'ALL') yq = yq.eq('enrolments.class_name', className);
        const yr = await yq; if (yr.error) throw yr.error;
        setYearlyRows((yr.data || []) as any as MarkRow[]);
      } else setYearlyRows([]);

      const enrolmentIds = [...new Set(currentRows.map((r) => r.enrolment_id))];
      if (enrolmentIds.length) {
        const br = await supabase.from('v2_academic_benchmarks').select('enrolment_id,subject_id,tov,etr').in('enrolment_id', enrolmentIds);
        if (br.error) throw br.error;
        setBenchmarks((br.data || []) as BenchmarkRow[]);
      } else setBenchmarks([]);
    } catch (e: any) { setError(e.message || String(e)); setRows([]); setTrendRows([]); setYearlyRows([]); setBenchmarks([]); }
    finally { setLoading(false); }
  }

  const subjectGroups = useMemo(() => {
    const map = new Map<string, { name: string; subjectId: string; rows: MarkRow[] }>();
    rows.forEach((r) => {
      const key = r.subjects?.code || r.subject_id;
      if (!map.has(key)) map.set(key, { name: r.subjects?.name_ms || key, subjectId: r.subject_id, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return [...map.entries()].map(([code, value]) => ({ code, ...value, summary: buildAcademicSummary(value.rows) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  useEffect(() => {
    if (!subjectGroups.length) { setSubjectCode(''); return; }
    if (!subjectGroups.some((g) => g.code === subjectCode)) setSubjectCode(subjectGroups[0].code);
  }, [subjectGroups, subjectCode]);

  const selectedGroup = useMemo(() => subjectGroups.find((g) => g.code === subjectCode) || null, [subjectGroups, subjectCode]);
  const selectedAssessment = assessments.find((a) => a.id === assessmentId);
  const selectedClass = classes.find((c) => c.className === className);

  const selectedBenchmarks = useMemo(() => selectedGroup ? benchmarks.filter((b) => b.subject_id === selectedGroup.subjectId) : [], [benchmarks, selectedGroup]);
  const tovAverage = useMemo(() => average(selectedBenchmarks.map((b) => b.tov)), [selectedBenchmarks]);
  const etrAverage = useMemo(() => average(selectedBenchmarks.map((b) => b.etr)), [selectedBenchmarks]);
  const mbpkCount = useMemo(() => selectedGroup ? new Set(selectedGroup.rows.filter((r) => String(r.enrolments?.students?.oku_status || '').toUpperCase() === 'YA').map((r) => r.enrolment_id)).size : 0, [selectedGroup]);

  const comparison = useMemo(() => {
    if (!selectedGroup) return [];
    const map = new Map<string, MarkRow[]>();
    trendRows.filter((r) => (r.subjects?.code || r.subject_id) === selectedGroup.code).forEach((r) => {
      const code = r.assessments?.code || '?';
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(r);
    });
    const rounds = [...map.entries()].map(([code, rs]) => ({ code, value: buildAcademicSummary(rs).averageScore })).filter((x) => x.value !== null).sort((a, b) => assessmentOrder(a.code) - assessmentOrder(b.code));
    const result: Array<{ code: string; value: number }> = [];
    if (tovAverage !== null) result.push({ code: 'TOV', value: Number(tovAverage.toFixed(1)) });
    rounds.forEach((r) => result.push({ code: r.code, value: Number((r.value as number).toFixed(1)) }));
    if (etrAverage !== null) result.push({ code: 'ETR', value: Number(etrAverage.toFixed(1)) });
    return result;
  }, [selectedGroup, trendRows, tovAverage, etrAverage]);

  const yearlyTrend = useMemo(() => {
    if (!selectedGroup) return [];
    const map = new Map<number, MarkRow[]>();
    yearlyRows.filter((r) => (r.subjects?.code || r.subject_id) === selectedGroup.code).forEach((r) => {
      const y = Number(r.assessments?.school_year || 0);
      if (!y) return;
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    });
    return [...map.entries()].map(([schoolYear, rs]) => ({ schoolYear, average: buildAcademicSummary(rs).averageScore })).filter((x) => x.average !== null).sort((a, b) => a.schoolYear - b.schoolYear);
  }, [yearlyRows, selectedGroup]);

  return <>
    <PageHeader eyebrow="ANALISIS AKADEMIK" title="Analisis Akademik" actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>} />
    <GlassCard className="filter-card no-print"><div className="filter-grid four">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Pentaksiran<select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{assessments.map((a) => <option value={a.id} key={a.id}>{a.code}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={c.className} value={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label>
      <label>Mata Pelajaran<select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>{subjectGroups.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}

    <div className="stats-grid four">
      <StatCard icon={Users} label="Bilangan Calon" value={selectedGroup?.summary.total ?? 0} hint={className === 'ALL' ? 'Seluruh sekolah' : `${selectedClass?.yearLevel || ''} ${formatClass(className)}`} />
      <StatCard icon={Accessibility} label="MBPK" value={mbpkCount} tone="purple" />
      <StatCard icon={Target} label={selectedGroup ? `Jumlah MTM — ${selectedGroup.name}` : 'Jumlah MTM'} value={selectedGroup ? `${selectedGroup.summary.mtm} (${selectedGroup.summary.mtmPct.toFixed(1)}%)` : '—'} tone="green" />
      <StatCard icon={AlertTriangle} label={selectedGroup ? `Jumlah Intervensi — ${selectedGroup.name}` : 'Jumlah Intervensi'} value={selectedGroup ? `${selectedGroup.summary.intervention} (${selectedGroup.summary.interventionPct.toFixed(1)}%)` : '—'} tone="red" />
    </div>

    <GlassCard className="chart-card"><div className="card-toolbar"><div><h2>Perbandingan TOV → AR → ETR</h2></div></div>
      <div className="chart-height">{comparison.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={comparison}><XAxis dataKey="code" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="value" stroke="#7da4ff" strokeWidth={3}/></LineChart></ResponsiveContainer> : <div className="empty-inline">Tiada data perbandingan.</div>}</div>
    </GlassCard>

    {yearlyTrend.length > 1 && <GlassCard className="chart-card yearly-card"><div className="card-toolbar"><div><h2>Perbandingan Tahunan</h2></div></div>
      <div className="chart-height"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearlyTrend}><XAxis dataKey="schoolYear" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="average" stroke="#a78bfa" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
    </GlassCard>}

    <div className="subject-analysis-list">
      {loading ? <GlassCard className="loading-card">Memuatkan analisis...</GlassCard> : selectedGroup ? (() => {
        const group = selectedGroup;
        const items = GRADE_ORDER.map((grade) => ({ label: grade, count: group.summary.grades[grade], pct: group.summary.total ? (group.summary.grades[grade] / group.summary.total) * 100 : 0 }));
        const interventionNames = group.rows.filter((r) => (r.grade || '') === 'F' || (r.score !== null && r.score <= 19)).map((r) => r.enrolments?.students?.name).filter(Boolean) as string[];
        return <GlassCard className="subject-card" key={group.code}>
          <div className="subject-card-head"><div><div className="eyebrow">{selectedAssessment?.code}</div><h2>{group.name}</h2></div><div className="metric-pair">
            <span>Calon<strong>{group.summary.total}</strong></span><span>Hadir<strong>{group.summary.attended}</strong></span><span>TH<strong>{group.summary.absent}</strong></span>
            <span>TOV<strong>{tovAverage === null ? '—' : tovAverage.toFixed(1)}</strong></span><span>{selectedAssessment?.code || 'AR'}<strong>{group.summary.averageScore === null ? '—' : group.summary.averageScore.toFixed(1)}</strong></span><span>ETR<strong>{etrAverage === null ? '—' : etrAverage.toFixed(1)}</strong></span>
            <span>MTM<strong>{group.summary.mtm} ({group.summary.mtmPct.toFixed(1)}%)</strong></span><span>Intervensi<strong>{group.summary.intervention} ({group.summary.interventionPct.toFixed(1)}%)</strong></span>
          </div></div>
          <div className="subject-card-body"><DistributionBars items={items}/><InterventionPanel count={group.summary.intervention} percentage={group.summary.interventionPct} rule="F (≤19)"><div className="intervention-details" style={{width:'100%'}}><div className="intervention-list-title">Murid ({interventionNames.length})</div>{interventionNames.length ? <ul style={{maxHeight:'none',overflow:'visible',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',columnGap:'28px',rowGap:'4px',width:'100%',paddingLeft:'18px'}}>{interventionNames.map((n) => <li key={n}>{n}</li>)}</ul> : <p>Tiada murid.</p>}</div></InterventionPanel></div>
        </GlassCard>;
      })() : <GlassCard className="loading-card">Tiada data untuk pilihan ini.</GlassCard>}
    </div>
  </>;
}

function average(values: Array<number | null>) {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(Number(v))).map(Number);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
function formatClass(value: string) { return value ? value.charAt(0) + value.slice(1).toLowerCase() : ''; }
function assessmentOrder(code: string) {
  if (code === 'UASA') return 999;
  const match = code.match(/AR(\d+)/i);
  return match ? Number(match[1]) : 500;
}
