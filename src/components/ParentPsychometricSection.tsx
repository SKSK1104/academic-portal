import '../intelligence.css';
import '../parent-psychometric.css';
import { Brain } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { GlassCard } from './GlassCard';
import { MI_CODES, MI_COLORS, MI_LABELS, aptitudeStrengths, miLevel, tagCodes, type PsyProfile } from '../lib/intelligence';
import { BAHAGIAN_B_TEXT, FORMAT_TITLES, LEVEL_BANDS, MI_DESCRIPTIONS } from '../lib/psychometricText';

export type ParentPsychometric = Pick<PsyProfile, 'format' | 'year_level' | 'class_name' | 'scores' | 'dominant' | 'bahagian_b' | 'aptitude'> & { school_year: number };

const LEVEL_LABEL = { TINGGI: 'Tinggi', SEDERHANA: 'Sederhana', RENDAH: 'Rendah' } as const;

// Safety guard: if this section ever fails to draw, it disappears
// and the rest of the parent report is unaffected.
class SectionGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* optional section */ }
  render() { return this.state.failed ? null : this.props.children; }
}

export function ParentPsychometricSection({ profiles }: { profiles?: ParentPsychometric[] }) {
  if (!profiles?.length) return null;
  const latest = [...profiles].sort((a, b) => Number(b.school_year) - Number(a.school_year))[0];
  return <SectionGuard><PsychometricCard p={latest} /></SectionGuard>;
}

function PsychometricCard({ p }: { p: ParentPsychometric }) {
  const asProfile = p as unknown as PsyProfile;
  const dominant = tagCodes(asProfile);
  return <GlassCard className="parent-detail-card premium-parent-card parent-psy-card">
    <div className="parent-section-head"><div><span>PENTAKSIRAN PSIKOMETRIK · {p.school_year}</span><h2>{p.format === 'T4_APTITUD' ? 'Kekuatan Aptitud' : 'Kecerdasan Pelbagai'}</h2><p>{FORMAT_TITLES[p.format]}</p></div><Brain size={21} /></div>

    {dominant.length > 0 && <div className="parent-psy-dominant">
      <div className="parent-psy-dominant-label">{p.format === 'T4_APTITUD' ? 'Kekuatan anak anda' : dominant.length > 1 ? 'Kecerdasan dominan anak anda (skor sama tinggi)' : 'Kecerdasan dominan anak anda'}</div>
      <div className="parent-psy-dominant-list">{dominant.map((code) => <div key={code} className="parent-psy-dominant-item" style={{ borderColor: MI_COLORS[code] }}>
        <strong style={{ color: MI_COLORS[code] }}>{MI_LABELS[code]}</strong>
        <p>{MI_DESCRIPTIONS[code]}</p>
      </div>)}</div>
    </div>}

    {p.format === 'T4_APTITUD' ? <AptitudeDetail p={p} /> : <MiDetail p={p} />}
  </GlassCard>;
}

function MiDetail({ p }: { p: ParentPsychometric }) {
  const format = p.format as 'T5_IKEP' | 'T6_APTITUD';
  const rows = MI_CODES.filter((c) => typeof p.scores?.[c] === 'number').map((code) => {
    const score = p.scores![code] as number;
    return { code, name: MI_LABELS[code], score, level: miLevel(format, score) };
  });
  const b = p.bahagian_b;
  return <>
    <div className="parent-psy-chart"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }} barCategoryGap="22%">
        <CartesianGrid horizontal={false} strokeDasharray="3 7" />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Bar dataKey="score" radius={[0, 8, 8, 0]} isAnimationActive={false}>
          {rows.map((r) => <Cell key={r.code} fill={MI_COLORS[r.code]} />)}
          <LabelList dataKey="score" position="right" formatter={(v: any) => `${v}%`} className="parent-psy-bar-label" />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>

    <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table parent-psy-table">
      <thead><tr><th>Kecerdasan</th><th>Skor</th><th>Tahap</th><th className="parent-psy-desc-col">Penerangan</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.code}>
        <td><strong>{r.name}</strong><span className="parent-psy-desc-inline">{MI_DESCRIPTIONS[r.code]}</span></td>
        <td className="parent-psy-num">{r.score}%</td>
        <td><span className={`parent-psy-level lvl-${r.level}`}>{LEVEL_LABEL[r.level]}</span></td>
        <td className="parent-psy-desc parent-psy-desc-col">{MI_DESCRIPTIONS[r.code]}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="parent-psy-note">Interpretasi skor: {LEVEL_BANDS[format]}.</p>

    {format === 'T6_APTITUD' && b && <div className="parent-psy-b">
      <h3>Bahagian B</h3>
      <div className="parent-psy-b-grid">{(['menaakul', 'masalah'] as const).map((k) => {
        const v = b[k]; const t = BAHAGIAN_B_TEXT[k];
        const baik = typeof v === 'number' && v >= 8;
        return <div key={k} className="parent-psy-b-item">
          <div className="parent-psy-b-head"><strong>{t.label}</strong><span className={typeof v === 'number' ? (baik ? 'parent-psy-baik' : 'parent-psy-kurang') : ''}>{typeof v === 'number' ? `${v} / 15 · ${baik ? 'Baik' : 'Kurang Potensi'}` : 'Tiada skor'}</span></div>
          <p>{typeof v === 'number' ? (baik ? t.baik : t.kurang) : t.description}</p>
        </div>;
      })}</div>
      <p className="parent-psy-note">Interpretasi skor Bahagian B: 8 hingga 15 Baik, 1 hingga 7 Kurang Potensi.</p>
    </div>}
  </>;
}

function AptitudeDetail({ p }: { p: ParentPsychometric }) {
  const skills = p.aptitude || [];
  const s = aptitudeStrengths(skills);
  const sections: Array<['BM' | 'BI' | 'LM', string]> = [['BM', 'Verbal Linguistik: Bahasa Melayu'], ['BI', 'Verbal Linguistik: Bahasa Inggeris'], ['LM', 'Logik Matematik']];
  return <>
    {s && <div className="parent-psy-strength">
      <div><span>Verbal Linguistik (BM + BI)</span><strong>{s.VL}%</strong></div>
      <div><span>Logik Matematik</span><strong>{s.LM}%</strong></div>
    </div>}
    <div className="table-scroll parent-table-scroll"><table className="data-table parent-premium-table parent-psy-table">
      <thead><tr><th>Domain</th><th>Kemahiran</th><th>Skor</th><th>Interpretasi</th></tr></thead>
      <tbody>{sections.flatMap(([sec, label]) => skills.filter((k) => k.section === sec).map((k, i) => <tr key={k.key}>
        <td>{i === 0 ? <strong>{label}</strong> : ''}</td>
        <td>{k.label}</td>
        <td className="parent-psy-num">{k.score} / {k.max}</td>
        <td><span className={k.baik ? 'parent-psy-baik' : 'parent-psy-kurang'}>{k.baik ? 'Baik' : 'Kurang Potensi'}</span> <small className="parent-psy-threshold">(Baik ≥ {k.threshold})</small></td>
      </tr>))}</tbody>
    </table></div>
    <div className="parent-psy-defs">
      <div><strong>Verbal Linguistik</strong><p>{MI_DESCRIPTIONS.VL}</p></div>
      <div><strong>Logik Matematik</strong><p>{MI_DESCRIPTIONS.LM}</p></div>
    </div>
  </>;
}
