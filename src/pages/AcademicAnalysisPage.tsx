import { Accessibility, AlertTriangle, CalendarCheck, FileQuestion, Printer, Target, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { getAssessments, getAvailableYears, getClasses } from '../lib/data';
import { buildAcademicSummary, gradeFromScore } from '../lib/grade';
import { GRADE_ORDER } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { Assessment, Subject } from '../lib/types';

type EnrolmentRow = { id: string; student_id: string; class_name: string; year_level: number };
type StudentRow = { id: string; name: string; oku_status: string | null };
type MarkRow = { assessment_id: string; enrolment_id: string; subject_id: string; score: number | null; grade: string | null };
type BenchmarkRow = { enrolment_id: string; subject_id: string; tov: number | null; etr: number | null };
type OfferingRow = { subject_id: string; year_level: number; ar_enabled: boolean; uasa_enabled: boolean };
type Drilldown = { eventCode: string; grade: string; names: string[] } | null;
type ProgressEvent = { code: string; label: string; kind: 'TOV' | 'AR' | 'ETR'; assessmentId?: string; labelKey: string };

export function AcademicAnalysisPage() {
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
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [trendMarks, setTrendMarks] = useState<MarkRow[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  useEffect(() => {
    getAvailableYears().then((ys) => { setYears(ys); setYear(ys[0]); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    Promise.all([getClasses(year), getAssessments(year)]).then(([cs, ass]) => {
      setClasses(cs);
      const academic = ass.filter((a) => a.kind === 'AR' || a.kind === 'UASA');
      setAssessments(academic);
      setAssessmentId((prev) => academic.some((a) => a.id === prev) ? prev : (academic.find((a) => a.kind === 'AR') || academic[0])?.id || '');
      if (className !== 'ALL' && !cs.some((c) => c.className === className)) setClassName('ALL');
    }).catch((e) => setError(e.message));
  }, [year]);

  useEffect(() => { if (assessmentId) void loadScope(); }, [year, className, assessmentId, assessments]);

  async function loadScope() {
    setLoading(true); setError('');
    try {
      let enrolmentQuery = supabase.from('v2_enrolments').select('id,student_id,class_name,year_level').eq('school_year', year).eq('is_active', true);
      if (className !== 'ALL') enrolmentQuery = enrolmentQuery.eq('class_name', className);
      const enrolmentResult = await enrolmentQuery;
      if (enrolmentResult.error) throw enrolmentResult.error;
      const scopedEnrolments = (enrolmentResult.data || []) as EnrolmentRow[];
      setEnrolments(scopedEnrolments);

      const enrolmentIds = scopedEnrolments.map((e) => e.id);
      const studentIds = [...new Set(scopedEnrolments.map((e) => e.student_id))];
      const arAssessmentIds = assessments.filter((a) => a.kind === 'AR').map((a) => a.id);

      const [studentResult, currentResult, trendResult, benchmarkResult, offeringResult] = await Promise.all([
        studentIds.length ? supabase.from('v2_students').select('id,name,oku_status').in('id', studentIds) : Promise.resolve({ data: [], error: null }),
        enrolmentIds.length ? supabase.from('v2_academic_marks').select('assessment_id,enrolment_id,subject_id,score,grade').eq('assessment_id', assessmentId).in('enrolment_id', enrolmentIds) : Promise.resolve({ data: [], error: null }),
        enrolmentIds.length && arAssessmentIds.length ? supabase.from('v2_academic_marks').select('assessment_id,enrolment_id,subject_id,score,grade').in('assessment_id', arAssessmentIds).in('enrolment_id', enrolmentIds) : Promise.resolve({ data: [], error: null }),
        enrolmentIds.length ? supabase.from('v2_academic_benchmarks').select('enrolment_id,subject_id,tov,etr').in('enrolment_id', enrolmentIds) : Promise.resolve({ data: [], error: null }),
        supabase.from('v2_subject_offerings').select('subject_id,year_level,ar_enabled,uasa_enabled')
      ]);
      if (studentResult.error) throw studentResult.error;
      if (currentResult.error) throw currentResult.error;
      if (trendResult.error) throw trendResult.error;
      if (benchmarkResult.error) throw benchmarkResult.error;
      if (offeringResult.error) throw offeringResult.error;

      const currentMarks = (currentResult.data || []) as MarkRow[];
      const allTrendMarks = (trendResult.data || []) as MarkRow[];
      const subjectIds = [...new Set([...currentMarks, ...allTrendMarks, ...(benchmarkResult.data || [])].map((m: any) => m.subject_id).filter(Boolean))];
      const subjectResult = subjectIds.length ? await supabase.from('v2_subjects').select('id,code,name_ms,name_en').in('id', subjectIds) : { data: [], error: null };
      if (subjectResult.error) throw subjectResult.error;

      setStudents((studentResult.data || []) as StudentRow[]);
      setMarks(currentMarks);
      setTrendMarks(allTrendMarks);
      setBenchmarks((benchmarkResult.data || []) as BenchmarkRow[]);
      setOfferings((offeringResult.data || []) as OfferingRow[]);
      setSubjects((subjectResult.data || []) as Subject[]);
    } catch (e: any) {
      setError(e.message || String(e));
      setEnrolments([]); setStudents([]); setSubjects([]); setMarks([]); setTrendMarks([]); setBenchmarks([]); setOfferings([]);
    } finally { setLoading(false); }
  }

  const assessment = assessments.find((a) => a.id === assessmentId);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const enrolmentById = useMemo(() => new Map(enrolments.map((e) => [e.id, e])), [enrolments]);
  const arAssessments = useMemo(() => assessments.filter((a) => a.kind === 'AR').sort((a, b) => Number(a.sequence_no || 0) - Number(b.sequence_no || 0)), [assessments]);

  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subject: Subject; rows: MarkRow[] }>();
    [...marks, ...trendMarks].forEach((row) => {
      const subject = subjectById.get(row.subject_id);
      if (!subject) return;
      if (!map.has(subject.code)) map.set(subject.code, { subject, rows: [] });
    });
    subjects.forEach((subject) => { if (!map.has(subject.code)) map.set(subject.code, { subject, rows: [] }); });
    marks.forEach((row) => {
      const subject = subjectById.get(row.subject_id);
      if (subject) map.get(subject.code)?.rows.push(row);
    });
    return [...map.values()].sort((a, b) => a.subject.name_ms.localeCompare(b.subject.name_ms));
  }, [marks, trendMarks, subjects, subjectById]);

  useEffect(() => {
    if (!subjectGroups.length) { setSubjectCode(''); return; }
    if (!subjectGroups.some((g) => g.subject.code === subjectCode)) setSubjectCode(subjectGroups[0].subject.code);
  }, [subjectGroups, subjectCode]);

  const selected = useMemo(() => subjectGroups.find((g) => g.subject.code === subjectCode) || null, [subjectGroups, subjectCode]);
  const selectedSubject = selected?.subject || null;
  const currentRows = selected?.rows || [];
  const summary = useMemo(() => buildAcademicSummary(currentRows), [currentRows]);

  const candidateEnrolments = useMemo(() => {
    if (!selectedSubject || !assessment) return [];
    const enabledYears = new Set(offerings.filter((o) => o.subject_id === selectedSubject.id && (assessment.kind === 'UASA' ? o.uasa_enabled : o.ar_enabled)).map((o) => Number(o.year_level)));
    return enrolments.filter((e) => enabledYears.size === 0 || enabledYears.has(Number(e.year_level)));
  }, [selectedSubject, assessment, offerings, enrolments]);

  const candidateCount = candidateEnrolments.length;
  const attended = currentRows.filter((r) => (r.grade || '').toUpperCase() !== 'TH').length;
  const absent = currentRows.filter((r) => (r.grade || '').toUpperCase() === 'TH').length;
  const mbpkCount = useMemo(() => new Set(candidateEnrolments.filter((e) => String(studentById.get(e.student_id)?.oku_status || '').toUpperCase() === 'YA').map((e) => e.student_id)).size, [candidateEnrolments, studentById]);

  const candidateIdSet = useMemo(() => new Set(candidateEnrolments.map((e) => e.id)), [candidateEnrolments]);
  const selectedBenchmarks = useMemo(() => selectedSubject ? benchmarks.filter((b) => b.subject_id === selectedSubject.id && candidateIdSet.has(b.enrolment_id)) : [], [benchmarks, selectedSubject, candidateIdSet]);
  const tovAverage = average(selectedBenchmarks.map((b) => b.tov));
  const etrAverage = average(selectedBenchmarks.map((b) => b.etr));

  const progressEvents = useMemo<ProgressEvent[]>(() => {
    const ars = arAssessments.map((a) => ({ code: a.code, label: a.code, kind: 'AR' as const, assessmentId: a.id, labelKey: `${a.code}__label` }));
    return [{ code: 'TOV', label: 'TOV', kind: 'TOV', labelKey: 'TOV__label' }, ...ars, { code: 'ETR', label: 'ETR', kind: 'ETR', labelKey: 'ETR__label' }];
  }, [arAssessments]);

  const trajectory = useMemo(() => {
    if (!selectedSubject) return [];
    return progressEvents.map((event) => {
      if (event.kind === 'TOV') return { code: event.code, value: tovAverage === null ? null : round1(tovAverage) };
      if (event.kind === 'ETR') return { code: event.code, value: etrAverage === null ? null : round1(etrAverage) };
      const rows = trendMarks.filter((m) => m.subject_id === selectedSubject.id && m.assessment_id === event.assessmentId);
      const avg = buildAcademicSummary(rows).averageScore;
      return { code: event.code, value: avg === null ? null : round1(avg) };
    });
  }, [selectedSubject, progressEvents, trendMarks, tovAverage, etrAverage]);

  const interventionRows = useMemo(() => currentRows.filter((r) => (r.grade || '').toUpperCase() === 'F' || (r.score !== null && Number(r.score) <= 19)).map((r) => {
    const enrolment = enrolmentById.get(r.enrolment_id);
    const student = enrolment ? studentById.get(enrolment.student_id) : null;
    return { id: r.enrolment_id, name: student?.name || '—', grade: r.grade || 'F', score: r.score };
  }).sort((a, b) => (a.score ?? 999) - (b.score ?? 999) || a.name.localeCompare(b.name)), [currentRows, enrolmentById, studentById]);

  const gradeProgression = useMemo(() => {
    if (!selectedSubject) return [];
    return GRADE_ORDER.map((grade) => {
      const row: Record<string, string | number> = { grade };
      progressEvents.forEach((event) => {
        const people = gradeMembers(event, grade, selectedSubject.id, selectedBenchmarks, trendMarks, enrolmentById, studentById);
        row[event.code] = people.length;
        row[event.labelKey] = people.length ? String(people.length) : '';
      });
      return row;
    });
  }, [selectedSubject, progressEvents, selectedBenchmarks, trendMarks, enrolmentById, studentById]);

  const gradeMembership = useMemo(() => {
    if (!selectedSubject) return [];
    return GRADE_ORDER.map((grade) => {
      const rowsForGrade = currentRows.filter((r) => String(r.grade || '').toUpperCase() === grade);
      const names = rowsForGrade.map((r) => {
        const enrolment = enrolmentById.get(r.enrolment_id);
        return enrolment ? studentById.get(enrolment.student_id)?.name || '—' : '—';
      }).sort((a, b) => a.localeCompare(b));
      return { grade, names };
    });
  }, [selectedSubject, currentRows, enrolmentById, studentById]);

  const eventCoverage = useMemo(() => progressEvents.map((event) => {
    if (!selectedSubject) return { code: event.code, total: 0 };
    if (event.kind === 'AR') return { code: event.code, total: trendMarks.filter((m) => m.subject_id === selectedSubject.id && m.assessment_id === event.assessmentId).length };
    return { code: event.code, total: selectedBenchmarks.filter((b) => event.kind === 'TOV' ? b.tov !== null : b.etr !== null).length };
  }), [progressEvents, selectedSubject, selectedBenchmarks, trendMarks]);

  function openGradeDrilldown(event: ProgressEvent, grade: string) {
    if (!selectedSubject || !grade) return;
    const names = gradeMembers(event, grade, selectedSubject.id, selectedBenchmarks, trendMarks, enrolmentById, studentById).map((x) => x.name);
    setDrilldown({ eventCode: event.code, grade, names });
  }

  const currentAverage = summary.averageScore;
  const deltaTov = currentAverage !== null && tovAverage !== null ? currentAverage - tovAverage : null;
  const gapEtr = currentAverage !== null && etrAverage !== null ? etrAverage - currentAverage : null;
  const classDisplay = className === 'ALL' ? 'Seluruh Sekolah' : `${classes.find((c) => c.className === className)?.yearLevel || ''} ${formatClass(className)}`.trim();

  return <>
    <style>{`
      .academic-mobile-events{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(96px,1fr))!important;gap:8px!important;padding:10px 0!important}
      .academic-mobile-events>div{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-width:0!important;padding:9px 11px!important;border:1px solid rgba(124,205,255,.18)!important;border-radius:12px!important;background:rgba(7,27,50,.56)!important}
      .academic-mobile-events strong{font-size:12px!important;letter-spacing:.08em!important;color:#9feaff!important}
      .academic-mobile-events span{font-size:13px!important;font-weight:800!important;color:#fff!important;white-space:nowrap!important}
      .grade-progression-card .grade-progression-chart{height:300px!important;min-height:300px!important}
      .grade-progression-card .recharts-bar-rectangle path{filter:drop-shadow(0 4px 8px rgba(0,0,0,.20))}
      .trajectory-card .recharts-bar-rectangle path{filter:drop-shadow(0 5px 10px rgba(255,191,46,.20))}
      .performance-summary-wide .summary-row{background:rgba(7,25,47,.42)!important;border:1px solid rgba(126,199,244,.14)!important;border-radius:12px!important;padding:11px 13px!important}
      .performance-summary-grid{gap:8px!important}
      @media(max-width:780px){
        .grade-chart-toolbar{align-items:flex-start!important;gap:10px!important;flex-wrap:wrap!important}
        .grade-chart-toolbar .status-chip{font-size:11px!important;max-width:210px!important;white-space:normal!important;line-height:1.2!important}
        .academic-mobile-events{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .grade-progression-card .grade-progression-chart{height:270px!important;min-height:270px!important}
        .trajectory-card .chart-height.large{height:260px!important}
        .performance-summary-grid{display:grid!important;grid-template-columns:1fr 1fr!important}
        .performance-summary-wide .summary-row{display:block!important;min-width:0!important}
        .performance-summary-wide .summary-row span{display:block!important;font-size:12px!important;color:#a9bfd3!important}
        .performance-summary-wide .summary-row strong{display:block!important;margin-top:4px!important;font-size:18px!important;color:#fff!important}
      }
    `}</style>
    <PageHeader title="Analisis Akademik" actions={<button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16}/> Cetak</button>} />

    <GlassCard className="filter-card no-print"><div className="filter-grid four">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Pentaksiran<select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{assessments.map((a) => <option value={a.id} key={a.id}>{a.code}</option>)}</select></label>
      <label>Kelas<select value={className} onChange={(e) => setClassName(e.target.value)}><option value="ALL">Seluruh Sekolah</option>{classes.map((c) => <option key={c.className} value={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label>
      <label>Mata Pelajaran<select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>{subjectGroups.map((g) => <option key={g.subject.code} value={g.subject.code}>{g.subject.name_ms}</option>)}</select></label>
    </div></GlassCard>

    {error && <div className="notice">{error}</div>}

    <div className="pristine-analysis-title">
      <div className="analysis-context"><h2>{classDisplay}<span>{selectedSubject?.name_ms || 'Pilih mata pelajaran'} · {assessment?.code || '—'}</span></h2><p>SK Simpang Kuda · Tahun {year}</p></div>
      <div className="context-rule" />
    </div>

    <div className="stats-grid six">
      <StatCard icon={Users} label="Bilangan Calon" value={candidateCount} />
      <StatCard icon={CalendarCheck} label="Hadir" value={attended} hint={candidateCount ? `${(attended / candidateCount * 100).toFixed(1)}%` : '0.0%'} />
      <StatCard icon={FileQuestion} label="TH" value={absent} hint={candidateCount ? `${(absent / candidateCount * 100).toFixed(1)}%` : '0.0%'} />
      <StatCard icon={Accessibility} label="MBPK" value={mbpkCount} />
      <StatCard icon={Target} label="MTM" value={`${summary.mtm}`} hint={`${summary.mtmPct.toFixed(1)}%`} tone="amber" />
      <StatCard icon={AlertTriangle} label="Intervensi" value={summary.intervention} hint={`${summary.interventionPct.toFixed(1)}%`} tone="red" />
    </div>

    <div className="diagnostic-grid">
      <div className="trajectory-stack">
        <GlassCard className="chart-card trajectory-card premium-card">
          <div className="card-toolbar"><div><h2>Trajektori Prestasi</h2></div><div className="status-chip">TOV → AR → ETR</div></div>
          <div className="event-visibility-strip academic-mobile-events">{trajectory.map((p) => <div key={p.code}><strong>{p.code}</strong><span>{p.value === null ? 'Tiada data' : p.value.toFixed(1)}</span></div>)}</div>
          <div className="chart-height large">{loading ? <div className="empty-inline">Memuatkan analisis…</div> : trajectory.some((x) => x.value !== null) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={trajectory} margin={{top:34,right:14,bottom:8,left:0}}><CartesianGrid vertical={false}/><XAxis dataKey="code" tickLine={false} axisLine={{stroke:'rgba(172,211,239,.55)'}} tick={{fontSize:14,fontWeight:800,fill:'#b9ccdf'}}/><YAxis domain={[0,100]} width={38} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#9fb5ca'}}/><Tooltip formatter={(v) => [`${v}`, 'Purata']} contentStyle={{background:'rgba(5,20,39,.97)',border:'1px solid rgba(112,205,255,.38)',borderRadius:12,color:'#fff',fontSize:13}} labelStyle={{color:'#fff',fontWeight:800}} itemStyle={{color:'#ccecff'}}/><Bar dataKey="value" fill="#ffd166" radius={[8,8,2,2]} maxBarSize={72}><LabelList dataKey="value" position="top" formatter={(value: any) => value === null ? '' : Number(value).toFixed(1)} className="trajectory-bar-label"/></Bar></BarChart></ResponsiveContainer> : <div className="empty-inline">Tiada data trajektori.</div>}</div>
        </GlassCard>

        <GlassCard className="summary-panel intervention-card intervention-under-trajectory premium-card"><div className="intervention-body"><h3>Senarai Murid Memerlukan Intervensi ({interventionRows.length})</h3>{interventionRows.length ? <table className="intervention-table"><thead><tr><th>Bil</th><th>Nama Murid</th><th>Gred</th><th>Markah</th></tr></thead><tbody>{interventionRows.map((r,i) => <tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td className="score">{r.grade}</td><td>{r.score ?? '—'}</td></tr>)}</tbody></table> : <div className="empty-inline">Tiada murid dalam kategori intervensi.</div>}</div></GlassCard>
      </div>

      <GlassCard className="target-panel premium-card">
        <div><h3>Sasaran & Pencapaian</h3><div className="target-number">{currentAverage === null ? '—' : currentAverage.toFixed(1)} <small>/ {etrAverage === null ? '—' : etrAverage.toFixed(1)}</small></div></div>
        <div className="target-meta"><div>Berbanding TOV: <strong className={deltaTov !== null && deltaTov >= 0 ? 'delta-positive' : 'delta-negative'}>{deltaTov === null ? '—' : `${deltaTov >= 0 ? '+' : ''}${deltaTov.toFixed(1)}`}</strong></div><div style={{marginTop:8}}>Baki ke ETR: <strong>{gapEtr === null ? '—' : `${gapEtr.toFixed(1)} markah`}</strong></div></div>
      </GlassCard>
    </div>

    <GlassCard className="summary-panel grade-progression-card premium-card">
      <div className="card-toolbar grade-chart-toolbar"><div><h2>Taburan Gred</h2></div><span className="status-chip">Ketuk bar untuk senarai murid</span></div>
      <div className="event-visibility-strip grade-event-strip academic-mobile-events">{eventCoverage.map((e) => <div key={e.code}><strong>{e.code}</strong><span>{e.total ? `${e.total} rekod` : 'Tiada data'}</span></div>)}</div>
      <div className="grade-progression-chart">{selectedSubject && gradeProgression.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={gradeProgression} margin={{top:20,right:8,bottom:8,left:0}} barCategoryGap="18%" barGap={2}><CartesianGrid vertical={false}/><XAxis dataKey="grade" tickLine={false} axisLine={{stroke:'rgba(172,211,239,.55)'}} tick={{fontSize:14,fontWeight:900,fill:'#c3d4e4'}}/><YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#9fb5ca'}}/><Tooltip formatter={(value, name) => [`${value} murid`, String(name)]} contentStyle={{background:'rgba(5,20,39,.97)',border:'1px solid rgba(112,205,255,.38)',borderRadius:12,color:'#fff',fontSize:13}} labelStyle={{color:'#fff',fontWeight:900}} itemStyle={{color:'#dff5ff'}}/>{progressEvents.map((event, index) => <Bar key={event.code} dataKey={event.code} name={event.label} fill={eventColor(index, progressEvents.length)} radius={[5,5,1,1]} maxBarSize={18} cursor="pointer" onClick={(data: any) => openGradeDrilldown(event, String(data?.payload?.grade || data?.grade || ''))}/>)}</BarChart></ResponsiveContainer> : <div className="empty-inline">Tiada data taburan gred.</div>}</div>
    </GlassCard>

    <GlassCard className="summary-panel performance-summary-wide premium-card"><h3>Rumusan Prestasi</h3><div className="performance-summary-grid"><div className="summary-row"><span>Purata TOV</span><strong>{tovAverage === null ? '—' : tovAverage.toFixed(1)}</strong></div><div className="summary-row"><span>Purata {assessment?.code || 'AR'}</span><strong>{currentAverage === null ? '—' : currentAverage.toFixed(1)}</strong></div><div className="summary-row"><span>ETR</span><strong>{etrAverage === null ? '—' : etrAverage.toFixed(1)}</strong></div><div className="summary-row"><span>MTM</span><strong>{summary.mtm} ({summary.mtmPct.toFixed(1)}%)</strong></div><div className="summary-row"><span>Intervensi</span><strong>{summary.intervention} ({summary.interventionPct.toFixed(1)}%)</strong></div></div></GlassCard>

    <GlassCard className="summary-panel grade-membership-card premium-card"><div className="card-toolbar"><div><h2>Senarai Murid Mengikut Gred</h2></div><span className="status-chip">{assessment?.code || 'Pentaksiran semasa'} · Cetakan lengkap</span></div><div className="grade-membership-scroll"><table className="data-table grade-membership-table compact-grade-table"><thead><tr><th>Gred</th><th>Bilangan</th><th>Nama Murid</th></tr></thead><tbody>{gradeMembership.map((row) => <tr key={row.grade}><td className="grade-membership-grade"><strong>{row.grade}</strong></td><td className="grade-membership-total"><strong>{row.names.length}</strong></td><td>{row.names.length ? <div className="grade-membership-names inline-names">{row.names.map((name) => <span key={name}>{name}</span>)}</div> : <span className="muted-cell">Tiada murid</span>}</td></tr>)}</tbody></table></div></GlassCard>

    {drilldown && <div className="grade-modal-backdrop no-print" role="dialog" aria-modal="true" aria-label={`Murid gred ${drilldown.grade} ${drilldown.eventCode}`} onMouseDown={(e) => { if (e.currentTarget === e.target) setDrilldown(null); }}>
      <div className="grade-modal"><div className="grade-modal-head"><div><span>{drilldown.eventCode}</span><h2>Gred {drilldown.grade}</h2></div><button className="icon-button" onClick={() => setDrilldown(null)} aria-label="Tutup"><X size={18}/></button></div><div className="grade-modal-count">{drilldown.names.length} murid</div>{drilldown.names.length ? <ol className="grade-modal-list">{drilldown.names.map((name) => <li key={name}>{name}</li>)}</ol> : <div className="empty-inline">Tiada murid dalam kategori ini.</div>}</div>
    </div>}
  </>;
}

function gradeMembers(event: ProgressEvent, grade: string, subjectId: string, benchmarkRows: BenchmarkRow[], markRows: MarkRow[], enrolmentById: Map<string, EnrolmentRow>, studentById: Map<string, StudentRow>) {
  const members: Array<{ enrolmentId: string; name: string }> = [];
  if (event.kind === 'AR') {
    markRows.filter((m) => m.subject_id === subjectId && m.assessment_id === event.assessmentId && String(m.grade || '').toUpperCase() === grade).forEach((m) => {
      const enrolment = enrolmentById.get(m.enrolment_id);
      const student = enrolment ? studentById.get(enrolment.student_id) : null;
      members.push({ enrolmentId: m.enrolment_id, name: student?.name || '—' });
    });
  } else {
    benchmarkRows.forEach((b) => {
      const score = event.kind === 'TOV' ? b.tov : b.etr;
      if (score === null || grade === 'TH' || gradeFromScore(Number(score)) !== grade) return;
      const enrolment = enrolmentById.get(b.enrolment_id);
      const student = enrolment ? studentById.get(enrolment.student_id) : null;
      members.push({ enrolmentId: b.enrolment_id, name: student?.name || '—' });
    });
  }
  return members.sort((a, b) => a.name.localeCompare(b.name));
}

function eventColor(index: number, total: number) {
  if (index === 0) return '#42dcff';
  if (index === total - 1) return '#ffd166';
  const palette = ['#5b8cff', '#9f78ff', '#ff72bf', '#4ee2b1', '#ff9f43'];
  return palette[(index - 1) % palette.length];
}
function average(values: Array<number | null>) {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(Number(v))).map(Number);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
function round1(value: number) { return Number(value.toFixed(1)); }
function formatClass(value: string) { return value ? value.charAt(0) + value.slice(1).toLowerCase() : ''; }
