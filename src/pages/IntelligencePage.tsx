import '../intelligence.css';
import { UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { IntelligenceTag } from '../components/IntelligenceTag';
import { PageHeader } from '../components/PageHeader';
import { FORMAT_LABELS, MI_CODES, MI_COLORS, MI_LABELS, aptitudeStrengths, miLevel, tagCodes, type MiCode, type PsyProfile } from '../lib/intelligence';
import { loadProfileYears, loadProfiles, matchToRoster, parsePsychometricPdf, saveProfiles, type MatchResult, type StoredProfile } from '../lib/intelligenceData';

const tooltipStyle = { background: 'rgba(5,20,39,.97)', border: '1px solid rgba(112,205,255,.38)', borderRadius: 12, color: '#fff', fontSize: 13 };
const SHORT: Record<MiCode, string> = { VL: 'VL', LM: 'LM', INTRA: 'Intra', VR: 'VR', NT: 'NT', INTER: 'Inter', KN: 'KN', MZ: 'MZ', EK: 'EK' };

interface Preview { fileName: string; profiles: PsyProfile[]; errors: string[]; match: MatchResult }

export function IntelligencePage() {
  const thisYear = new Date().getFullYear();
  const [uploadYear, setUploadYear] = useState(thisYear);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(thisYear);
  const [stored, setStored] = useState<StoredProfile[]>([]);
  const [classKey, setClassKey] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => { void refreshYears(); }, []);
  useEffect(() => { void loadYear(year); }, [year]);

  async function refreshYears() {
    try {
      const ys = await loadProfileYears();
      setYears(ys.length ? ys : [thisYear]);
      if (ys.length && !ys.includes(year)) setYear(ys[0]);
    } catch (e: any) { setLoadError(e.message || String(e)); }
  }

  async function loadYear(y: number) {
    setLoadError('');
    try { setStored(await loadProfiles(y)); }
    catch (e: any) { setLoadError(e.message || String(e)); setStored([]); }
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(true); setStatus('Membaca PDF…'); setPreview(null);
    try {
      const parsed = await parsePsychometricPdf(file);
      const pdfYear = parsed.profiles[0]?.school_year;
      if (pdfYear && pdfYear !== uploadYear) {
        setStatus(`PDF ini untuk tahun ${pdfYear}, tetapi tahun dipilih ialah ${uploadYear}. Tukar tahun dan cuba semula.`);
        return;
      }
      const match = await matchToRoster(parsed.profiles, uploadYear);
      setPreview({ fileName: file.name, profiles: parsed.profiles, errors: parsed.errors, match });
      setStatus('');
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function confirmSave() {
    if (!preview) return;
    setBusy(true); setStatus('Menyimpan…');
    try {
      const n = await saveProfiles(preview.match.matched, uploadYear);
      setStatus(`${n} profil murid berjaya disimpan.`);
      setPreview(null);
      await refreshYears();
      if (year === uploadYear) await loadYear(uploadYear); else setYear(uploadYear);
    } catch (e: any) { setStatus(e.message || String(e)); }
    finally { setBusy(false); }
  }

  const classes = useMemo(() => {
    const map = new Map<string, { key: string; label: string; level: number }>();
    stored.forEach(({ profile: p }) => {
      const key = `${p.year_level}|${p.class_name}`;
      map.set(key, { key, label: `${p.year_level} ${cap(p.class_name)}`, level: p.year_level });
    });
    return [...map.values()].sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }, [stored]);

  useEffect(() => {
    if (!classes.some((c) => c.key === classKey)) setClassKey(classes[0]?.key || '');
  }, [classes, classKey]);

  const pupils = useMemo(() => stored
    .map((s) => s.profile)
    .filter((p) => `${p.year_level}|${p.class_name}` === classKey)
    .sort((a, b) => a.name.localeCompare(b.name)), [stored, classKey]);

  const format = pupils[0]?.format;
  const canSave = !!preview && !busy && !preview.errors.length && preview.match.matched.length > 0;

  return <>
    <PageHeader title="Kecerdasan Pelbagai" />

    <GlassCard className="mi-upload">
      <div className="mi-upload-row">
        <label>Tahun<input type="number" value={uploadYear} onChange={(e) => { setUploadYear(Number(e.target.value)); setPreview(null); }} /></label>
        <div>
          <label className="upload-button"><UploadCloud size={16} /> {busy ? 'Memproses…' : 'Pilih PDF Psikometrik'}<input type="file" accept="application/pdf" hidden disabled={busy} onChange={(e) => { void handleFile(e.target.files); e.target.value = ''; }} /></label>
        </div>
      </div>
      <p className="mi-help">Satu PDF satu kelas. Format Tahun 4, 5 dan 6 dikenal pasti secara automatik. Murid dipadankan melalui MyKid sahaja, dan hanya profil kecerdasan disimpan. Markah AR, UASA dan PBD tidak disentuh.</p>
    </GlassCard>

    {status && <div className={`notice ${status.includes('berjaya') ? 'success' : ''}`}>{status}</div>}

    {preview && <GlassCard className="preview-card">
      <div className="card-toolbar"><div><h2>{preview.fileName}</h2><p>{preview.profiles[0] ? FORMAT_LABELS[preview.profiles[0].format] : 'Tidak dikenal pasti'}</p></div><span className="status-chip">Pratonton</span></div>
      <div className="preview-summary">
        <div>{preview.profiles.length} murid dalam PDF</div>
        <div>{preview.match.matched.length} sepadan dengan roster</div>
        <div>{preview.match.unmatched.length} tidak sepadan</div>
      </div>
      {preview.errors.map((w) => <div className="warning-row" key={w}>Ralat: {w}</div>)}
      {preview.match.unmatched.length > 0 && <div className="warning-row">Tidak disimpan (MyKid tiada dalam roster {uploadYear}): {preview.match.unmatched.map((p) => p.name).join(', ')}</div>}
      {preview.match.classMismatch.map((w) => <div className="warning-row" key={w}>Kelas berbeza — {w}</div>)}
      {preview.profiles[0]?.format === 'T4_APTITUD' && <div className="warning-row">PDF Tahun 4 ialah ujian aptitud. Tag Tahun 4 menunjukkan kekuatan murid: Verbal Linguistik (BM + BI) atau Logik Matematik, berdasarkan peratus skor yang lebih tinggi.</div>}
      <div className="table-scroll" style={{ maxHeight: 320 }}>
        <table className="data-table"><thead><tr><th>Nama</th><th>Kecerdasan dominan</th></tr></thead>
          <tbody>{preview.profiles.map((p) => <tr key={p.mykid}><td>{p.name}</td><td>{tagCodes(p).length ? <IntelligenceTag profile={p} /> : '—'}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={() => setPreview(null)}>Batal</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => void confirmSave()}>Simpan {preview.match.matched.length} profil</button>
      </div>
    </GlassCard>}

    <GlassCard className="filter-card">
      <div className="filter-grid two">
        <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <label>Kelas<select value={classKey} onChange={(e) => setClassKey(e.target.value)} disabled={!classes.length}>{classes.length ? classes.map((c) => <option key={c.key} value={c.key}>{c.label}</option>) : <option>Tiada data</option>}</select></label>
      </div>
    </GlassCard>

    {loadError && <div className="notice">{loadError}</div>}
    {!pupils.length ? <GlassCard className="placeholder-card"><h2>Belum ada data untuk {year}</h2><p>Muat naik PDF psikometrik di atas untuk melihat analisis kelas.</p></GlassCard>
      : format === 'T4_APTITUD' ? <AptitudeAnalysis pupils={pupils} /> : <MiAnalysis pupils={pupils} />}
  </>;
}

function MiAnalysis({ pupils }: { pupils: PsyProfile[] }) {
  const format = pupils[0].format;
  const averages = MI_CODES.map((code) => {
    const vals = pupils.map((p) => p.scores?.[code]).filter((v): v is number => typeof v === 'number');
    return { code, name: SHORT[code], label: MI_LABELS[code], avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
  });
  const dominantCounts = MI_CODES.map((code) => ({ code, name: SHORT[code], label: MI_LABELS[code], count: pupils.filter((p) => p.dominant?.includes(code)).length }));
  const levels = MI_CODES.map((code) => {
    const row = { name: SHORT[code], TINGGI: 0, SEDERHANA: 0, RENDAH: 0 };
    pupils.forEach((p) => { const v = p.scores?.[code]; if (typeof v === 'number') row[miLevel(format, v)] += 1; });
    return row;
  });
  const topCount = Math.max(...dominantCounts.map((d) => d.count));
  const topDominant = { label: dominantCounts.filter((d) => d.count === topCount).map((d) => d.label).join(' dan '), count: topCount };
  const topAverage = [...averages].sort((a, b) => b.avg - a.avg)[0];
  const lowAverage = [...averages].sort((a, b) => a.avg - b.avg)[0];
  const tied = pupils.filter((p) => (p.dominant?.length || 0) > 1).length;

  return <>
    <div className="mi-stats">
      <GlassCard className="mi-stat"><span>Kecerdasan dominan paling ramai</span><strong>{topDominant.label}</strong><small>{topDominant.count} daripada {pupils.length} murid</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata tertinggi</span><strong>{topAverage.label}</strong><small>Purata {topAverage.avg}%</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata terendah</span><strong>{lowAverage.label}</strong><small>Purata {lowAverage.avg}%</small></GlassCard>
    </div>

    <div className="mi-charts">
      <GlassCard className="mi-chart"><div className="card-toolbar"><div><h2>Bilangan murid mengikut kecerdasan dominan</h2></div></div>
        <div className="mi-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={dominantCounts} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} murid`, 'Dominan']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>{dominantCounts.map((d) => <Cell key={d.code} fill={MI_COLORS[d.code]} />)}</Bar>
        </BarChart></ResponsiveContainer></div>
        <p className="mi-note">{tied} murid mempunyai lebih daripada satu kecerdasan dominan (skor seri), dan dikira dalam setiap kecerdasan tersebut.</p>
      </GlassCard>

      <GlassCard className="mi-chart"><div className="card-toolbar"><div><h2>Purata skor kelas (%)</h2></div></div>
        <div className="mi-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={averages} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis domain={[0, 100]} width={34} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Purata']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]}>{averages.map((d) => <Cell key={d.code} fill={MI_COLORS[d.code]} />)}</Bar>
        </BarChart></ResponsiveContainer></div>
      </GlassCard>
    </div>

    <GlassCard className="mi-chart" >
      <div className="card-toolbar"><div><h2>Tahap mengikut kecerdasan</h2><p>{format === 'T6_APTITUD' ? 'Tinggi 80–100%, Sederhana 50–79%, Rendah di bawah 50%' : 'Tinggi 75–100%, Sederhana 50–74%, Rendah di bawah 50%'}</p></div></div>
      <div className="mi-chart-body tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={levels} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} /><YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} /><Legend />
        <Bar dataKey="TINGGI" name="Tinggi" stackId="a" fill="#4fd6a0" />
        <Bar dataKey="SEDERHANA" name="Sederhana" stackId="a" fill="#ffc44d" />
        <Bar dataKey="RENDAH" name="Rendah" stackId="a" fill="#ff7a8a" radius={[6, 6, 0, 0]} />
      </BarChart></ResponsiveContainer></div>
    </GlassCard>

    {format === 'T6_APTITUD' && <GlassCard className="mi-chart" >
      <div className="card-toolbar"><div><h2>Bahagian B</h2><p>Baik 8–15, Kurang Potensi 1–7</p></div></div>
      <div className="mi-b-grid">{([['menaakul', 'Kemahiran Menaakul'], ['masalah', 'Kemahiran Menyelesaikan Masalah']] as const).map(([k, label]) => {
        const vals = pupils.map((p) => p.bahagian_b?.[k] ?? null);
        const baik = vals.filter((v) => v !== null && v >= 8).length;
        const kurang = vals.filter((v) => v !== null && v < 8).length;
        const tiada = vals.filter((v) => v === null).length;
        return <div key={k}><h3>{label}</h3><p className="mi-baik">Baik: {baik} murid</p><p className="mi-kurang">Kurang Potensi: {kurang} murid</p>{tiada > 0 && <p>Tiada skor dalam PDF: {tiada} murid</p>}</div>;
      })}</div>
    </GlassCard>}

    <GlassCard className="table-card" >
      <div className="card-toolbar"><div><h2>Profil murid</h2></div><span className="status-chip">{pupils.length} murid</span></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Bil</th><th>Nama murid</th><th>Dominan</th>{MI_CODES.map((c) => <th key={c} title={MI_LABELS[c]}>{SHORT[c]}</th>)}{format === 'T6_APTITUD' && <><th>Menaakul</th><th>Masalah</th></>}</tr></thead>
        <tbody>{pupils.map((p, i) => <tr key={p.mykid}>
          <td>{i + 1}</td><td className="student-name">{p.name}</td><td><IntelligenceTag profile={p} /></td>
          {MI_CODES.map((c) => { const v = p.scores?.[c]; return <td key={c} className={`mi-cell ${typeof v === 'number' ? 'mi-' + miLevel(format, v) : ''}`}>{v ?? '—'}</td>; })}
          {format === 'T6_APTITUD' && <><td className="mi-cell">{p.bahagian_b?.menaakul ?? '—'}</td><td className="mi-cell">{p.bahagian_b?.masalah ?? '—'}</td></>}
        </tr>)}</tbody>
      </table></div>
      <div className="mi-legend"><span className="mi-TINGGI">■ Tinggi</span><span className="mi-SEDERHANA">■ Sederhana</span><span className="mi-RENDAH">■ Rendah</span></div>
    </GlassCard>
  </>;
}

function AptitudeAnalysis({ pupils }: { pupils: PsyProfile[] }) {
  const skills = pupils[0].aptitude || [];
  const skillStats = skills.map((s, idx) => {
    const rows = pupils.map((p) => p.aptitude?.[idx]).filter(Boolean) as NonNullable<PsyProfile['aptitude']>;
    return { name: s.label, section: s.section, Baik: rows.filter((r) => r.baik).length, Kurang: rows.filter((r) => !r.baik).length };
  });
  const sectionPct = (p: PsyProfile, section: 'BM' | 'BI' | 'LM') => {
    const rows = (p.aptitude || []).filter((a) => a.section === section);
    const max = rows.reduce((a, r) => a + r.max, 0);
    return max ? Math.round(rows.reduce((a, r) => a + r.score, 0) / max * 100) : 0;
  };
  const avg = (section: 'BM' | 'BI' | 'LM') => Math.round(pupils.reduce((a, p) => a + sectionPct(p, section), 0) / pupils.length);
  const weakest = [...skillStats].sort((a, b) => b.Kurang - a.Kurang)[0];
  const tagsOf = pupils.map((p) => tagCodes(p));
  const strongBoth = tagsOf.filter((t) => t.length === 2).length;
  const strongVL = tagsOf.filter((t) => t.length === 1 && t[0] === 'VL').length;
  const strongLM = tagsOf.filter((t) => t.length === 1 && t[0] === 'LM').length;

  return <>
    <div className="notice">Tahun 4 menggunakan Ujian Aptitud, bukan inventori kecerdasan pelbagai. Tag kekuatan setiap murid ialah Verbal Linguistik (BM + BI) atau Logik Matematik, mengikut peratus skor yang lebih tinggi; kedua-duanya dipaparkan jika sama.</div>
    <div className="mi-stats">
      <GlassCard className="mi-stat"><span>Purata Bahasa Melayu</span><strong>{avg('BM')}%</strong><small>Verbal Linguistik</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata Bahasa Inggeris</span><strong>{avg('BI')}%</strong><small>Verbal Linguistik</small></GlassCard>
      <GlassCard className="mi-stat"><span>Purata Logik Matematik</span><strong>{avg('LM')}%</strong><small>Kemahiran paling lemah: {weakest?.name}</small></GlassCard>
    </div>
    <div className="notice">Kekuatan murid: Verbal Linguistik {strongVL} murid, Logik Matematik {strongLM} murid{strongBoth ? `, sama kuat ${strongBoth} murid` : ''}.</div>
    <GlassCard className="mi-chart" >
      <div className="card-toolbar"><div><h2>Baik dan Kurang Potensi mengikut kemahiran</h2></div></div>
      <div className="mi-chart-body tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={skillStats} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} /><Legend />
        <Bar dataKey="Baik" stackId="a" fill="#4fd6a0" />
        <Bar dataKey="Kurang" name="Kurang Potensi" stackId="a" fill="#ff7a8a" />
      </BarChart></ResponsiveContainer></div>
    </GlassCard>
    <GlassCard className="table-card" >
      <div className="card-toolbar"><div><h2>Profil murid</h2><p>Skor / markah penuh</p></div><span className="status-chip">{pupils.length} murid</span></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Bil</th><th>Nama murid</th><th>Kekuatan</th>{skills.map((s) => <th key={s.key} title={s.label}>{s.label}</th>)}<th>BM %</th><th>BI %</th><th>LM %</th><th>VL %</th></tr></thead>
        <tbody>{pupils.map((p, i) => <tr key={p.mykid}>
          <td>{i + 1}</td><td className="student-name">{p.name}</td><td><IntelligenceTag profile={p} /></td>
          {(p.aptitude || []).map((a) => <td key={a.key} className={`mi-cell ${a.baik ? 'mi-baik' : 'mi-kurang'}`}>{a.score}/{a.max}</td>)}
          <td className="mi-cell">{sectionPct(p, 'BM')}</td><td className="mi-cell">{sectionPct(p, 'BI')}</td><td className="mi-cell">{sectionPct(p, 'LM')}</td><td className="mi-cell">{aptitudeStrengths(p.aptitude)?.VL ?? '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="mi-legend"><span className="mi-baik">■ Baik</span><span className="mi-kurang">■ Kurang Potensi</span></div>
    </GlassCard>
  </>;
}

function cap(s: string) { return s ? s.charAt(0) + s.slice(1).toLowerCase() : ''; }
