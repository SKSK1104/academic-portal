import { AlertTriangle, Printer, Target, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { DistributionBars } from '../components/DistributionBars';
import { InterventionPanel } from '../components/InterventionPanel';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getAssessments, getAvailableYears, getClasses } from '../lib/data';
import { buildPbdSummary } from '../lib/grade';
import { TP_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { Assessment } from '../lib/types';

interface PbdRow {
  tp: number;
  subject_id: string;
  subjects: { code: string; name_ms: string } | null;
  enrolments: { class_name: string; students: { name: string } | null } | null;
  assessments?: { code: string; school_year: number } | null;
}

export function PbdAnalysisPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classes, setClasses] = useState<Array<{ className: string; yearLevel: number }>>([]);
  const [className, setClassName] = useState('ALL');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [rows, setRows] = useState<PbdRow[]>([]);
  const [trendRows, setTrendRows] = useState<PbdRow[]>([]);
  const [yearlyRows, setYearlyRows] = useState<PbdRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year, 'PBD')]).then(([c, a]) => {
      setClasses(c); setAssessments(a); setAssessmentId(a[0]?.id || '');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (assessmentId) void load(); }, [assessmentId, className]);

  async function load() {
    setError('');
    const selected = assessments.find((a) => a.id === assessmentId);
    let q = supabase.from('v2_pbd_records')
      .select('tp,subject_id,subjects(code,name_ms),enrolments!inner(class_name,students(name))')
      .eq('assessment_id', assessmentId);
    if (className !== 'ALL') q = q.eq('enrolments.class_name', className);
    const { data, error } = await q;
    if (error) { setError(error.message); return; }
    setRows((data || []) as any);

    let tq = supabase.from('v2_pbd_records')
      .select('tp,subject_id,subjects(code,name_ms),enrolments!inner(class_name),assessments!inner(code,school_year)')
      .eq('assessments.school_year', year);
    if (className !== 'ALL') tq = tq.eq('enrolments.class_name', className);
    const tr = await tq;
    if (!tr.error) setTrendRows((tr.data || []) as any);

    if (selected?.code) {
      let yq = supabase.from('v2_pbd_records')
        .select('tp,subject_id,subjects(code,name_ms),enrolments!inner(class_name),assessments!inner(code,school_year)')
        .eq('assessments.code', selected.code);
      if (className !== 'ALL') yq = yq.eq('enrolments.class_name', className);
      const yr = await yq;
      if (!yr.error) setYearlyRows((yr.data || []) as any);
    }
  }

  const overall = useMemo(() => buildPbdSummary(rows), [rows]);
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: PbdRow[] }>();
    rows.forEach((r) => {
      const k = r.subjects?.code || r.subject_id;
      if (!m.has(k)) m.set(k, { name: r.subjects?.name_ms || k, rows: [] });
      m.get(k)!.rows.push(r);
    });
    return [...m.entries()].map(([code, v]) => ({ code, ...v, summary: buildPbdSummary(v.rows) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const roundTrend = useMemo(() => {
    const m = new Map<string, PbdRow[]>();
    trendRows.forEach((r) => {
      const code = r.assessments?.code || '?';
      if (!m.has(code)) m.set(code, []);
      m.get(code)!.push(r);
    });
    return [...m.entries()].map(([code, rs]) => {
      const s = buildPbdSummary(rs);
      return { code, mtm: Number(s.mtmPct.toFixed(1)), intervention: Number(s.interventionPct.toFixed(1)) };
    }).sort((a, b) => a.code.localeCompare(b.code, 'ms', { numeric: true }));
  }, [trendRows]);

  const yearlyTrend = useMemo(() => {
    const m = new Map<number, PbdRow[]>();
    yearlyRows.forEach((r) => {
      const y = Number(r.assessments?.school_year || 0);
      if (!y) return;
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(r);
    });
    return [...m.entries()].map(([schoolYear, rs]) => {
      const s = buildPbdSummary(rs);
      return { schoolYear, mtm: Number(s.mtmPct.toFixed(1)), intervention: Number(s.interventionPct.toFixed(1)) };
    }).sort((a, b) => a.schoolYear - b.schoolYear);
  }, [yearlyRows]);

  return <>
    <PageHeader eyebrow="PBD" title="Analisis PBD" description="Setiap subjek memaparkan TP1–TP6 dan Memerlukan Intervensi untuk TP1–TP2." actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>}/>
    <GlassCard className="filter-card no-print"><div className="filter-grid three">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Pusingan PBD<select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{assessments.map((a) => <option value={a.id} key={a.id}>{a.title || a.code}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={c.className}>{c.className}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}
    <div className="stats-grid three"><StatCard icon={Users} label="Rekod PBD" value={overall.total}/><StatCard icon={Target} label="MTM" value={`${overall.mtmPct.toFixed(1)}%`} hint="TP3–TP6" tone="green"/><StatCard icon={AlertTriangle} label="Intervensi" value={overall.intervention} hint={`${overall.interventionPct.toFixed(1)}% • TP1–TP2`} tone="red"/></div>

    <GlassCard className="chart-card"><div className="card-toolbar"><div><h2>Trend PBD Dalam Tahun</h2><p>MTM dan intervensi dibandingkan antara pusingan PBD yang tersedia.</p></div></div>
      <div className="chart-height">{roundTrend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={roundTrend}><XAxis dataKey="code" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="mtm" stroke="#34d399" strokeWidth={3}/><Line type="monotone" dataKey="intervention" stroke="#fb7185" strokeWidth={3}/></LineChart></ResponsiveContainer> : <div className="empty-inline">Trend pusingan akan muncul selepas lebih daripada satu pusingan PBD diimport.</div>}</div>
    </GlassCard>

    <GlassCard className="chart-card yearly-card"><div className="card-toolbar"><div><h2>Perbandingan Tahunan PBD</h2><p>Muncul automatik apabila pusingan yang sama wujud dalam lebih daripada satu tahun.</p></div></div>
      <div className="chart-height">{yearlyTrend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={yearlyTrend}><XAxis dataKey="schoolYear" stroke="#8fa2bf"/><YAxis domain={[0,100]} stroke="#8fa2bf"/><Tooltip contentStyle={{background:'#0e1830',border:'1px solid #2b3b59',borderRadius:12}}/><Line type="monotone" dataKey="mtm" stroke="#34d399" strokeWidth={3}/><Line type="monotone" dataKey="intervention" stroke="#fb7185" strokeWidth={3}/></LineChart></ResponsiveContainer> : <div className="empty-inline">Perbandingan tahunan akan muncul apabila data tahun berikutnya tersedia.</div>}</div>
    </GlassCard>

    <div className="subject-analysis-list">{groups.map((g) => {
      const items = TP_ORDER.map((tp) => ({ label: tp, count: g.summary.tps[tp], pct: g.summary.total ? (g.summary.tps[tp] / g.summary.total) * 100 : 0 }));
      const names = g.rows.filter((r) => r.tp < 3).map((r) => r.enrolments?.students?.name).filter(Boolean) as string[];
      return <GlassCard className="subject-card" key={g.code}><div className="subject-card-head"><div><div className="eyebrow">PBD</div><h2>{g.name}</h2></div><div className="metric-pair"><span>MTM<strong>{g.summary.mtmPct.toFixed(1)}%</strong></span><span>Rekod<strong>{g.summary.total}</strong></span></div></div><div className="subject-card-body"><DistributionBars items={items}/><InterventionPanel count={g.summary.intervention} percentage={g.summary.interventionPct} rule="TP1 dan TP2"><details className="intervention-details"><summary>Lihat murid ({names.length})</summary>{names.length ? <ul>{names.map((n) => <li key={n}>{n}</li>)}</ul> : <p>Tiada murid.</p>}</details></InterventionPanel></div></GlassCard>;
    })}</div>
  </>;
}
