import { Accessibility, AlertTriangle, Target, Users } from 'lucide-react';
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
interface PublicClass { class_name: string; year_level: number; }
interface CohortSummary { candidates: number; mbpk: number; }

export function PublicAcademicPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assessments, setAssessments] = useState<PublicAssessment[]>([]);
  const [assessment, setAssessment] = useState('');
  const [classes, setClasses] = useState<PublicClass[]>([]);
  const [className, setClassName] = useState('ALL');
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [subjectCode, setSubjectCode] = useState('ALL');
  const [cohort, setCohort] = useState<CohortSummary>({ candidates: 0, mbpk: 0 });
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
      setClasses(((data || []) as PublicClass[]).map((x) => ({ class_name: x.class_name, year_level: Number(x.year_level) })));
      setClassName('ALL');
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
    const classArg = className === 'ALL' ? null : className;
    const [summaryResult, cohortResult] = await Promise.all([
      supabase.rpc('v2_public_academic_summary', { p_year: year, p_assessment_code: assessment, p_class_name: classArg }),
      supabase.rpc('v2_public_academic_cohort_summary', { p_year: year, p_assessment_code: assessment, p_class_name: classArg }),
    ]);
    if (summaryResult.error || cohortResult.error) {
      setError(summaryResult.error?.message || cohortResult.error?.message || 'Ralat memuatkan data.');
      setRows([]); setCohort({ candidates: 0, mbpk: 0 }); return;
    }
    setRows((summaryResult.data || []) as SummaryRow[]);
    const c = (cohortResult.data || [])[0] as CohortSummary | undefined;
    setCohort({ candidates: Number(c?.candidates || 0), mbpk: Number(c?.mbpk || 0) });
    setSubjectCode('ALL');
  }

  const selectedRow = useMemo(() => rows.find((r) => r.subject_code === subjectCode) || null, [rows, subjectCode]);
  const visibleRows = useMemo(() => subjectCode === 'ALL' ? rows : rows.filter((r) => r.subject_code === subjectCode), [rows, subjectCode]);
  const mtmCount = selectedRow ? Number(selectedRow.A || 0) + Number(selectedRow.B || 0) + Number(selectedRow.C || 0) + Number(selectedRow.D || 0) + Number(selectedRow.E || 0) : 0;
  const interventionCount = selectedRow ? Number(selectedRow.F || 0) : 0;

  return <div className="public-report">
    <PageHeader title="Prestasi Akademik" />
    <GlassCard className="filter-card"><div className="filter-grid four">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={`${c.year_level}-${c.class_name}`} value={c.class_name}>{c.year_level} {c.class_name.charAt(0) + c.class_name.slice(1).toLowerCase()}</option>)}</select></label>
      <label>Pentaksiran<select value={assessment} onChange={(e) => setAssessment(e.target.value)}>{assessments.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}</select></label>
      <label>Mata Pelajaran<select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}><option value="ALL">Semua Mata Pelajaran</option>{rows.map((r) => <option key={r.subject_code} value={r.subject_code}>{r.subject_name}</option>)}</select></label>
    </div></GlassCard>
    {error && <div className="notice">{error}</div>}
    <div className="stats-grid four">
      <StatCard icon={Users} label="Bilangan Calon" value={cohort.candidates}/>
      <StatCard icon={Accessibility} label="MBPK" value={cohort.mbpk}/>
      <StatCard icon={Target} label={selectedRow ? `Jumlah MTM — ${selectedRow.subject_name}` : 'Jumlah MTM'} value={selectedRow ? `${mtmCount} (${Number(selectedRow.mtm_pct || 0).toFixed(1)}%)` : '—'} hint={selectedRow ? undefined : 'Pilih mata pelajaran'} tone="amber"/>
      <StatCard icon={AlertTriangle} label={selectedRow ? `Jumlah Intervensi — ${selectedRow.subject_name}` : 'Jumlah Intervensi'} value={selectedRow ? `${interventionCount} (${Number(selectedRow.intervention_pct || 0).toFixed(1)}%)` : '—'} hint={selectedRow ? 'Gred F' : 'Pilih mata pelajaran'} tone="red"/>
    </div>
    <div className="subject-analysis-list">{visibleRows.map((r) => {
      const items = GRADE_ORDER.map((g) => ({ label: g, count: Number(r[g] || 0), pct: r.total ? Number(r[g] || 0) / r.total * 100 : 0 }));
      const subjectMtm = Number(r.A || 0) + Number(r.B || 0) + Number(r.C || 0) + Number(r.D || 0) + Number(r.E || 0);
      return <GlassCard className="subject-card" key={r.subject_code}><div className="subject-card-head"><div><div className="eyebrow">{assessment}</div><h2>{r.subject_name}</h2></div><div className="metric-pair"><span>Bilangan Calon<strong>{Number(r.total || 0)}</strong></span><span>Bilangan Hadir<strong>{Number(r.attended || 0)}</strong></span><span>TH<strong>{Number(r.TH || 0)}</strong></span><span>MTM<strong>{subjectMtm} ({Number(r.mtm_pct || 0).toFixed(1)}%)</strong></span><span>Intervensi<strong>{Number(r.F || 0)} ({Number(r.intervention_pct || 0).toFixed(1)}%)</strong></span></div></div><div className="subject-card-body single"><DistributionBars items={items}/></div></GlassCard>;
    })}</div>
  </div>;
}
