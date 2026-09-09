import { AlertTriangle, BarChart3, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DistributionBars } from '../components/DistributionBars';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { GRADE_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';

interface SummaryRow {
  subject_code: string;
  subject_name: string;
  total: number;
  attended: number;
  A: number; B: number; C: number; D: number; E: number; F: number; TH: number;
  mtm_pct: number;
  intervention_pct: number;
}
interface PublicAssessment { code: string; kind: string; title: string; sequence_no: number | null; }

export function PublicAcademicPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assessments, setAssessments] = useState<PublicAssessment[]>([]);
  const [assessment, setAssessment] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [className, setClassName] = useState('ALL');
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('v2_public_years').then(({ data }) => {
      const ys = (data || []).map((x: any) => Number(x.school_year));
      setYears(ys); if (ys[0]) setYear(ys[0]);
    });
  }, []);

  useEffect(() => {
    if (!year) return;
    supabase.rpc('v2_public_classes', { p_year: year }).then(({ data }) => {
      setClasses((data || []).map((x: any) => x.class_name)); setClassName('ALL');
    });
    supabase.rpc('v2_public_assessments', { p_year: year }).then(({ data, error }) => {
      if (error) { setError(error.message); return; }
      const academic = ((data || []) as PublicAssessment[]).filter((x) => x.kind === 'AR' || x.kind === 'UASA');
      setAssessments(academic); setAssessment(academic[0]?.code || '');
    });
  }, [year]);

  useEffect(() => { if (assessment) void load(); }, [year, assessment, className]);

  async function load() {
    setError('');
    const { data, error } = await supabase.rpc('v2_public_academic_summary', { p_year: year, p_assessment_code: assessment, p_class_name: className === 'ALL' ? null : className });
    if (error) { setError(error.message); setRows([]); return; }
    setRows((data || []) as SummaryRow[]);
  }

  const total = useMemo(() => rows.reduce((a, r) => a + Number(r.total || 0), 0), [rows]);
  const intervention = useMemo(() => rows.reduce((a, r) => a + Number(r.F || 0), 0), [rows]);
  const attended = useMemo(() => rows.reduce((a, r) => a + Number(r.attended || 0), 0), [rows]);

  return <div className="public-report">
    <PageHeader eyebrow="LAPORAN UMUM" title="Prestasi Akademik" description="Data agregat sahaja. Tiada nama murid dipaparkan."/>
    <GlassCard className="filter-card"><div className="filter-grid three">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Pentaksiran<select value={assessment} onChange={(e) => setAssessment(e.target.value)}>{assessments.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}
    <div className="stats-grid three"><StatCard icon={Users} label="Rekod" value={total}/><StatCard icon={BarChart3} label="Hadir" value={attended} tone="green"/><StatCard icon={AlertTriangle} label="Intervensi" value={intervention} hint="Gred F" tone="red"/></div>
    <div className="subject-analysis-list">{rows.map((r) => {
      const items = GRADE_ORDER.map((g) => ({ label: g, count: Number(r[g] || 0), pct: r.total ? Number(r[g] || 0) / r.total * 100 : 0 }));
      return <GlassCard className="subject-card" key={r.subject_code}><div className="subject-card-head"><div><div className="eyebrow">{assessment}</div><h2>{r.subject_name}</h2></div><div className="metric-pair"><span>MTM<strong>{Number(r.mtm_pct || 0).toFixed(1)}%</strong></span><span>Intervensi<strong>{Number(r.intervention_pct || 0).toFixed(1)}%</strong></span></div></div><div className="subject-card-body single"><DistributionBars items={items}/></div></GlassCard>;
    })}</div>
  </div>;
}
