import { AlertTriangle, BarChart3, Printer, TrendingUp, Users } from 'lucide-react';
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
  score: number | null;
  grade: string | null;
  subject_id: string;
  subjects: { code: string; name_ms: string } | null;
  enrolments: { class_name: string; students: { name: string } | null } | null;
  assessments: { code: string; kind: string; sequence_no: number | null } | null;
}

export function AcademicAnalysisPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('ALL');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [trendRows, setTrendRows] = useState<MarkRow[]>([]);
  const [yearlyRows, setYearlyRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch(console.error); }, []);
  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year)]).then(([cs, ass]) => {
      setClasses(cs); setAssessments(ass.filter((a) => a.kind === 'AR' || a.kind === 'UASA'));
      const preferred = ass.find((a) => a.kind === 'AR') || ass.find((a) => a.kind === 'UASA');
      setAssessmentId(preferred?.id || '');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (assessmentId) void load(); }, [year, assessmentId, className]);

  async function load() {
    setLoading(true); setError('');
    try {
      let q = supabase.from('v2_academic_marks').select('score,grade,subject_id,subjects(code,name_ms),enrolments!inner(class_name,students(name)),assessments!inner(code,kind,sequence_no)')
        .eq('assessment_id', assessmentId);
      if (className !== 'ALL') q = q.eq('enrolments.class_name', className);
      const { data, error } = await q; if (error) throw error;
      setRows((data || []) as any);

      let tq = supabase.from('v2_academic_marks').select('score,grade,subject_id,subjects(code,name_ms),enrolments!inner(class_name,students(name)),assessments!inner(code,kind,sequence_no,school_year)')
        .eq('assessments.school_year', year);
      if (className !== 'ALL') tq = tq.eq('enrolments.class_name', className);
      const tr = await tq; if (tr.error) throw tr.error;
      setTrendRows((tr.data || []) as any);

      const code = assessments.find((a) => a.id === assessmentId)?.code;
      if (code) {
        let yq = supabase.from('v2_academic_marks').select('score,grade,subjects(code,name_ms),enrolments!inner(class_name),assessments!inner(code,school_year)').eq('assessments.code', code);
        if (className !== 'ALL') yq = yq.eq('enrolments.class_name', className);
        const yr = await yq; if (yr.error) throw yr.error;
        setYearlyRows((yr.data || []) as any);
      } else setYearlyRows([]);
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }

  const summary = useMemo(() => buildAcademicSummary(rows), [rows]);
  const uniqueStudents = useMemo(() => new Set(rows.map((r) => `${r.enrolments?.class_name || ''}|${r.enrolments?.students?.name || ''}`).filter((x) => !x.endsWith('|'))).size, [rows]);
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { name: string; rows: MarkRow[] }>();
    rows.forEach((r) => {
      const key = r.subjects?.code || r.subject_id;
      if (!map.has(key)) map.set(key, { name: r.subjects?.name_ms || key, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return [...map.entries()].map(([code, value]) => ({ code, ...value, summary: buildAcademicSummary(value.rows) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const trend = useMemo(() => {
    const map = new Map<string, MarkRow[]>();
    trendRows.forEach((r) => {
      const code = r.assessments?.code || '?';
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(r);
    });
    return [...map.entries()].map(([code, rs]) => {
      const s = buildAcademicSummary(rs);
      return { code, mtm: Number(s.mtmPct.toFixed(1)), intervention: Number(s.interventionPct.toFixed(1)), average: s.averageScore ? Number(s.averageScore.toFixed(1)) : null };
    }).sort((a, b) => assessmentOrder(a.code) - assessmentOrder(b.code));
  }, [trendRows]);

  const yearlyTrend = useMemo(() => {
    const map = new Map<number, any[]>();
    yearlyRows.forEach((r: any) => {
      const y = Number(r.assessments?.school_year || 0);
      if (!y) return;
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    });
    return [...map.entries()].map(([schoolYear, rs]) => {
      const s = buildAcademicSummary(rs);
      return { schoolYear, mtm: Number(s.mtmPct.toFixed(1)), intervention: Number(s.interventionPct.toFixed(1)), average: s.averageScore ? Number(s.averageScore.toFixed(1)) : null };
    }).sort((a, b) => a.schoolYear - b.schoolYear);
  }, [yearlyRows]);

  const selectedAssessment = assessments.find((a) => a.id === assessmentId);

  return <>
    <PageHeader eyebrow="HEADCOUNT & TREND" title="Analisis Akademik" description="Analisis AR dan UASA berada di satu tempat. Setiap subjek mengekalkan analisis gred dan kotak Memerlukan Intervensi." actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>} />
    <GlassCard className="filter-card no-print"><div className="filter-grid three">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Pentaksiran<select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{assessments.map((a) => <option value={a.id} key={a.id}>{a.code}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={c.className}>{c.className}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}
    <div className="stats-grid four">
      <StatCard icon={Users} label="Murid" value={uniqueStudents} hint={`${summary.total} rekod markah`} />
      <StatCard icon={BarChart3} label="MTM" value={`${summary.mtmPct.toFixed(1)}%`} hint={`${summary.mtm} rekod lulus`} tone="green" />
      <StatCard icon={AlertTriangle} label="Kes Intervensi" value={summary.intervention} hint={`${summary.interventionPct.toFixed(1)}% rekod gred F`} tone="red" />
      <StatCard icon={TrendingUp} label="Purata" value={summary.averageScore?.toFixed(1) ?? '—'} hint={selectedAssessment?.code || ''} tone="purple" />
    </div>

    <div className="analysis-grid">
      <GlassCard className="chart-card"><div className="card-toolbar"><div><h2>Trend Pentaksiran</h2><p>MTM dan intervensi mengikut pusingan.</p></div></div>
        <div className="chart-height">{trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><XAxis dataKey="code" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="mtm" stroke="#34d399" strokeWidth={3}/><Line type="monotone" dataKey="intervention" stroke="#fb7185" strokeWidth={3}/></LineChart></ResponsiveContainer> : <div className="empty-inline">Belum cukup pusingan untuk trend.</div>}</div>
      </GlassCard>
      <InterventionPanel count={summary.intervention} percentage={summary.interventionPct} rule="Gred F / markah 19 dan ke bawah" />
    </div>

    <GlassCard className="chart-card yearly-card"><div className="card-toolbar"><div><h2>Perbandingan Tahunan</h2><p>{selectedAssessment?.code || 'Pentaksiran'} dibandingkan secara automatik apabila lebih daripada satu tahun tersedia.</p></div></div>
      <div className="chart-height">{yearlyTrend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={yearlyTrend}><XAxis dataKey="schoolYear" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="mtm" stroke="#34d399" strokeWidth={3}/><Line type="monotone" dataKey="intervention" stroke="#fb7185" strokeWidth={3}/></LineChart></ResponsiveContainer> : <div className="empty-inline">Perbandingan tahunan akan muncul secara automatik selepas data tahun berikutnya diimport.</div>}</div>
    </GlassCard>

    <div className="subject-analysis-list">
      {loading ? <GlassCard className="loading-card">Memuatkan analisis...</GlassCard> : subjectGroups.map((group) => {
        const items = GRADE_ORDER.map((grade) => ({ label: grade, count: group.summary.grades[grade], pct: group.summary.total ? (group.summary.grades[grade] / group.summary.total) * 100 : 0 }));
        const interventionNames = group.rows.filter((r) => (r.grade || '') === 'F' || (r.score !== null && r.score <= 19)).map((r) => r.enrolments?.students?.name).filter(Boolean) as string[];
        return <GlassCard className="subject-card" key={group.code}>
          <div className="subject-card-head"><div><div className="eyebrow">{selectedAssessment?.code}</div><h2>{group.name}</h2></div><div className="metric-pair"><span>MTM<strong>{group.summary.mtmPct.toFixed(1)}%</strong></span><span>Calon<strong>{group.summary.total}</strong></span></div></div>
          <div className="subject-card-body"><DistributionBars items={items}/><InterventionPanel count={group.summary.intervention} percentage={group.summary.interventionPct} rule="F (≤19)"><details className="intervention-details"><summary>Lihat murid ({interventionNames.length})</summary>{interventionNames.length ? <ul>{interventionNames.map((n) => <li key={n}>{n}</li>)}</ul> : <p>Tiada murid.</p>}</details></InterventionPanel></div>
        </GlassCard>;
      })}
    </div>
  </>;
}

function assessmentOrder(code: string) {
  if (code === 'UASA') return 999;
  const match = code.match(/AR(\d+)/i);
  return match ? Number(match[1]) : 500;
}
