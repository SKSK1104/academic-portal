import '../intelligence.css';
import '../public-psychometric.css';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { MI_CODES, MI_COLORS, MI_LABELS, type MiCode } from '../lib/intelligence';
import { supabase } from '../lib/supabase';

// Public page: built ONLY from class-level totals returned by
// v2_public_psychometric_summary. It never receives names or individual scores.

interface MiStat { avg: number; dominant: number; tinggi: number; sederhana: number; rendah: number }
interface BCount { baik: number; kurang: number; tiada: number }
interface SkillStat { key: string; label: string; section: string; max: number; baik: number; kurang: number }
interface ClassSummary {
  year_level: number; class_name: string; format: 'T4_APTITUD' | 'T5_IKEP' | 'T6_APTITUD'; pupils: number;
  summary: {
    intelligences?: Partial<Record<MiCode, MiStat>>; tied?: number;
    bahagian_b?: { menaakul: BCount; masalah: BCount } | null;
    sections?: { BM: number; BI: number; LM: number };
    strength?: { VL: number; LM: number; BOTH: number };
    skills?: SkillStat[];
  };
}

const tooltipStyle = { background: 'rgba(5,20,39,.97)', border: '1px solid rgba(112,205,255,.38)', borderRadius: 12, color: '#fff', fontSize: 13 };
const SHORT: Record<MiCode, string> = { VL: 'VL', LM: 'LM', INTRA: 'Intra', VR: 'VR', NT: 'NT', INTER: 'Inter', KN: 'KN', MZ: 'MZ', EK: 'EK' };
const cap = (s: string) => s ? s.charAt(0) + s.slice(1).toLowerCase() : '';

export function PublicPsychometricPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(0);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classKey, setClassKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('v2_public_psychometric_years').then(({ data, error: e }) => {
      if (e) { setError('Data pentaksiran psikometrik belum tersedia.'); setLoading(false); return; }
      const ys = (data || []).map((r: any) => Number(r.school_year)).filter(Boolean);
      setYears(ys);
      if (ys[0]) setYear(ys[0]); else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!year) return;
    setLoading(true); setError('');
    supabase.rpc('v2_public_psychometric_summary', { p_year: year }).then(({ data, error: e }) => {
      if (e) { setError('Data pentaksiran psikometrik belum tersedia.'); setClasses([]); }
      else {
        const rows = (data || []) as ClassSummary[];
        setClasses(rows);
        setClassKey((k) => rows.some((r) => `${r.year_level}|${r.class_name}` === k) ? k : rows[0] ? `${rows[0].year_level}|${rows[0].class_name}` : '');
      }
      setLoading(false);
    });
  }, [year]);

  const current = useMemo(() => classes.find((c) => `${c.year_level}|${c.class_name}` === classKey), [classes, classKey]);

  return <div className="public-report psy-public">
    <PageHeader title="Pentaksiran Psikometrik" />
    <GlassCard className="filter-card"><div className="filter-grid two">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={!years.length}>{years.length ? years.map((y) => <option key={y} value={y}>{y}</option>) : <option>—</option>}</select></label>
      <label>Kelas<select value={classKey} onChange={(e) => setClassKey(e.target.value)} disabled={!classes.length}>{classes.length ? classes.map((c) => <option key={`${c.year_level}|${c.class_name}`} value={`${c.year_level}|${c.class_name}`}>{c.year_level} {cap(c.class_name)}</option>) : <option>Tiada data</option>}</select></label>
    </div></GlassCard>

    {error && <div className="notice">{error}</div>}
    {!error && !loading && !current && <GlassCard className="placeholder-card"><h2>Belum ada data</h2><p>Analisis akan dipaparkan selepas keputusan pentaksiran psikometrik dimuat naik.</p></GlassCard>}
    {current && <p className="psy-context">{current.year_level} {cap(current.class_name)} · {current.pupils} murid · {current.format === 'T4_APTITUD' ? 'Ujian Aptitud Tahun 4' : current.format === 'T5_IKEP' ? 'Inventori Kecerdasan Pelbagai (IKEP) Tahun 5' : 'Ujian Aptitud Tahun 6'}</p>}
    {current && (current.format === 'T4_APTITUD' ? <AptitudeView c={current} /> : <MiView c={current} />)}
  </div>;
}

function MiView({ c }: { c: ClassSummary }) {
  const intel = c.summary.intelligences || {};
  const rows = MI_CODES.filter((code) => intel[code]).map((code) => ({ code, name: SHORT[code], label: MI_LABELS[code], ...intel[code]! }));
  if (!rows.length) return null;
  const topCount = Math.max(...rows.map((r) => r.dominant));
  const topDominant = rows.filter((r) => r.dominant === topCount).map((r) => r.label).join(' dan ');
  const topAvg = [...rows].sort((a, b) => b.avg - a.avg)[0];
  const lowAvg = [...rows].sort((a, b) => a.avg - b.avg)[0];
  const b = c.summary.bahagian_b;

  return <>
    <div className="mi-stats">
      <GlassCard className="mi-stat"><span>Kecerdasan dominan paling ramai</span><strong>{topDominant}</strong><small>{topCount} daripada {c.pupils} murid</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata tertinggi</span><strong>{topAvg.label}</strong><small>Purata {topAvg.avg}%</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata terendah</span><strong>{lowAvg.label}</strong><small>Purata {lowAvg.avg}%</small></GlassCard>
    </div>
    <div className="mi-charts">
      <GlassCard className="mi-chart"><div className="card-toolbar"><div><h2>Bilangan murid mengikut kecerdasan dominan</h2></div></div>
        <div className="mi-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} murid`, 'Dominan']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} />
          <Bar dataKey="dominant" radius={[6, 6, 0, 0]}>{rows.map((r) => <Cell key={r.code} fill={MI_COLORS[r.code]} />)}</Bar>
        </BarChart></ResponsiveContainer></div>
        <p className="mi-note">{c.summary.tied || 0} murid mempunyai lebih daripada satu kecerdasan dominan (skor seri) dan dikira dalam setiap kecerdasan tersebut.</p>
      </GlassCard>
      <GlassCard className="mi-chart"><div className="card-toolbar"><div><h2>Purata skor kelas (%)</h2></div></div>
        <div className="mi-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis domain={[0, 100]} width={34} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Purata']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]}>{rows.map((r) => <Cell key={r.code} fill={MI_COLORS[r.code]} />)}</Bar>
        </BarChart></ResponsiveContainer></div>
      </GlassCard>
    </div>
    <GlassCard className="mi-chart psy-block">
      <div className="card-toolbar"><div><h2>Tahap mengikut kecerdasan</h2><p>{c.format === 'T6_APTITUD' ? 'Tinggi 80–100%, Sederhana 50–79%, Rendah di bawah 50%' : 'Tinggi 75–100%, Sederhana 50–74%, Rendah di bawah 50%'}</p></div></div>
      <div className="mi-chart-body tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} /><Legend />
        <Bar dataKey="tinggi" name="Tinggi" stackId="a" fill="#4fd6a0" />
        <Bar dataKey="sederhana" name="Sederhana" stackId="a" fill="#ffc44d" />
        <Bar dataKey="rendah" name="Rendah" stackId="a" fill="#ff7a8a" radius={[6, 6, 0, 0]} />
      </BarChart></ResponsiveContainer></div>
    </GlassCard>
    <GlassCard className="table-card psy-block">
      <div className="card-toolbar"><div><h2>Ringkasan kelas</h2></div><span className="status-chip">{c.pupils} murid</span></div>
      <div className="table-scroll"><table className="data-table psy-table">
        <thead><tr><th>Kecerdasan</th><th>Purata</th><th>Dominan</th><th>Tinggi</th><th>Sederhana</th><th>Rendah</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.code}><td><span className="psy-dot" style={{ background: MI_COLORS[r.code] }} />{r.label}</td><td>{r.avg}%</td><td>{r.dominant}</td><td>{r.tinggi}</td><td>{r.sederhana}</td><td>{r.rendah}</td></tr>)}</tbody>
      </table></div>
    </GlassCard>
    {c.format === 'T6_APTITUD' && b && <GlassCard className="mi-chart psy-block">
      <div className="card-toolbar"><div><h2>Bahagian B</h2><p>Baik 8–15, Kurang Potensi 1–7</p></div></div>
      <div className="mi-b-grid">{([['menaakul', 'Kemahiran Menaakul'], ['masalah', 'Kemahiran Menyelesaikan Masalah']] as const).map(([k, label]) => <div key={k}>
        <h3>{label}</h3><p className="mi-baik">Baik: {b[k].baik} murid</p><p className="mi-kurang">Kurang Potensi: {b[k].kurang} murid</p>{b[k].tiada > 0 && <p>Tiada skor dalam laporan: {b[k].tiada} murid</p>}
      </div>)}</div>
    </GlassCard>}
  </>;
}

function AptitudeView({ c }: { c: ClassSummary }) {
  const s = c.summary.sections; const st = c.summary.strength; const skills = c.summary.skills || [];
  const chart = skills.map((k) => ({ name: k.label, Baik: k.baik, Kurang: k.kurang }));
  const weakest = [...skills].sort((a, b) => b.kurang - a.kurang)[0];
  return <>
    <div className="notice">Tahun 4 menggunakan Ujian Aptitud, bukan inventori kecerdasan pelbagai. Kekuatan setiap murid ialah Verbal Linguistik (BM + BI) atau Logik Matematik, mengikut peratus skor yang lebih tinggi.</div>
    <div className="mi-stats">
      <GlassCard className="mi-stat"><span>Purata Bahasa Melayu</span><strong>{s?.BM ?? '—'}%</strong><small>Verbal Linguistik</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata Bahasa Inggeris</span><strong>{s?.BI ?? '—'}%</strong><small>Verbal Linguistik</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata Logik Matematik</span><strong>{s?.LM ?? '—'}%</strong><small>Kemahiran paling lemah: {weakest?.label}</small></GlassCard>
    </div>
    {st && <div className="mi-stats">
      <GlassCard className="mi-stat"><span>Kuat Verbal Linguistik</span><strong style={{ color: MI_COLORS.VL }}>{st.VL} murid</strong></GlassCard>
      <GlassCard className="mi-stat"><span>Kuat Logik Matematik</span><strong style={{ color: MI_COLORS.LM }}>{st.LM} murid</strong></GlassCard>
      <GlassCard className="mi-stat"><span>Sama kuat</span><strong>{st.BOTH} murid</strong></GlassCard>
    </div>}
    <GlassCard className="mi-chart psy-block">
      <div className="card-toolbar"><div><h2>Baik dan Kurang Potensi mengikut kemahiran</h2></div></div>
      <div className="mi-chart-body tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} /><Legend />
        <Bar dataKey="Baik" stackId="a" fill="#4fd6a0" />
        <Bar dataKey="Kurang" name="Kurang Potensi" stackId="a" fill="#ff7a8a" />
      </BarChart></ResponsiveContainer></div>
    </GlassCard>
    <GlassCard className="table-card psy-block">
      <div className="card-toolbar"><div><h2>Ringkasan kemahiran</h2></div><span className="status-chip">{c.pupils} murid</span></div>
      <div className="table-scroll"><table className="data-table psy-table">
        <thead><tr><th>Bahagian</th><th>Kemahiran</th><th>Markah penuh</th><th>Baik</th><th>Kurang Potensi</th></tr></thead>
        <tbody>{skills.map((k) => <tr key={k.key}><td>{k.section === 'BM' ? 'Bahasa Melayu' : k.section === 'BI' ? 'Bahasa Inggeris' : 'Logik Matematik'}</td><td>{k.label}</td><td>{k.max}</td><td className="mi-baik">{k.baik}</td><td className="mi-kurang">{k.kurang}</td></tr>)}</tbody>
      </table></div>
    </GlassCard>
  </>;
}
