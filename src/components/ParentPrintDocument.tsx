import '../parent-print-doc.css';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MI_CODES, MI_LABELS, aptitudeStrengths, miLevel, tagCodes, type PsyProfile } from '../lib/intelligence';
import { BAHAGIAN_B_TEXT, FORMAT_TITLES, LEVEL_BANDS, MI_DESCRIPTIONS } from '../lib/psychometricText';
import { SCHOOL_CODE, SCHOOL_NAME } from '../lib/constants';
import { SCHOOL_LOGO_DATA_URI } from '../lib/schoolLogo';
import type { ParentPsychometric } from './ParentPsychometricSection';

// A formal, print-only version of the parent report. It is rendered directly
// into <body> (outside the app), so when printing, the whole website is hidden
// and only this document appears. On screen it is never visible.

type AcademicRow = { assessment: string; subject_code: string; subject: string; score: number | null; grade: string | null };
type PbdRow = { assessment: string; subject_code: string; subject: string; tp: number };
type Round = { code: string };
type Subject = { code: string; name: string };

export interface ParentPrintProps {
  student: { name: string; student_id: string; class_name: string; year_level: number; school_year: number };
  academic: AcademicRow[];
  pbd: PbdRow[];
  psychometric?: ParentPsychometric[];
  academicRounds: Round[];
  academicSubjects: Subject[];
  pbdRounds: Round[];
  pbdSubjects: Subject[];
}

const LEVEL = { TINGGI: 'Tinggi', SEDERHANA: 'Sederhana', RENDAH: 'Rendah' } as const;

function fullSchoolName(name: string) {
  const n = name.trim();
  return (/^SK\s+/i.test(n) ? 'Sekolah Kebangsaan ' + n.replace(/^SK\s+/i, '') : n).toUpperCase();
}

function fmt(n: number | null | undefined, digits = 1) { return n === null || n === undefined ? '—' : n.toFixed(digits); }

export function ParentPrintDocument(props: ParentPrintProps) {
  // Only while a report is shown: printing hides the app and prints this document.
  useEffect(() => {
    document.body.classList.add('has-parent-print');
    return () => document.body.classList.remove('has-parent-print');
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(<PrintDoc {...props} />, document.body);
}

function PrintDoc({ student, academic, pbd, psychometric, academicRounds, academicSubjects, pbdRounds, pbdSubjects }: ParentPrintProps) {
  const printed = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  const cell = (s: string, r: string) => academic.find((x) => (x.subject_code || x.subject) === s && x.assessment === r);
  const roundAvg = (r: string) => {
    const rows = academic.filter((x) => x.assessment === r && x.score !== null);
    return rows.length ? rows.reduce((a, x) => a + Number(x.score), 0) / rows.length : null;
  };
  const latestRound = academicRounds[academicRounds.length - 1]?.code || '';
  const firstAvg = academicRounds.length ? roundAvg(academicRounds[0].code) : null;
  const latestAvg = latestRound ? roundAvg(latestRound) : null;
  const change = academicRounds.length > 1 && firstAvg !== null && latestAvg !== null ? latestAvg - firstAvg : null;
  const latestRows = academic.filter((x) => x.assessment === latestRound);
  const lulus = latestRows.filter((x) => x.grade && ['A', 'B', 'C', 'D', 'E'].includes(x.grade)).length;
  const gredF = latestRows.filter((x) => x.grade === 'F').length;

  const latestPbd = pbdRounds[pbdRounds.length - 1]?.code || '';
  const latestPbdRows = pbd.filter((x) => x.assessment === latestPbd);
  const tpCount = (tp: number) => latestPbdRows.filter((x) => x.tp === tp).length;

  const psy = psychometric?.length ? [...psychometric].sort((a, b) => Number(b.school_year) - Number(a.school_year))[0] : null;
  let section = 0;
  const next = () => String.fromCharCode(65 + section++);

  return <div className="parent-print-doc" aria-hidden="true">
    <header className="ppd-letterhead">
      <img src={SCHOOL_LOGO_DATA_URI} alt="" className="ppd-logo" />
      <div className="ppd-school">
        <div className="ppd-school-name">{fullSchoolName(SCHOOL_NAME)}</div>
        <div className="ppd-school-code">Kod Sekolah: {SCHOOL_CODE}</div>
        <div className="ppd-title">LAPORAN PRESTASI MURID TAHUN {student.school_year}</div>
      </div>
    </header>

    <table className="ppd-info"><tbody>
      <tr><th>Nama Murid</th><td colSpan={3}>{student.name}</td></tr>
      <tr><th>ID Murid</th><td>{student.student_id}</td><th>Kelas</th><td>{student.year_level} {student.class_name}</td></tr>
    </tbody></table>

    {academicRounds.length > 0 && <section className="ppd-section">
      <h2>{next()}. Prestasi Akademik</h2>
      <table className="ppd-summary"><tbody><tr>
        <td><span>Purata {latestRound}</span><strong>{fmt(latestAvg)}</strong></td>
        <td><span>Perubahan sejak {academicRounds[0].code}</span><strong>{change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}`}</strong></td>
        <td><span>Subjek Gred A–E ({latestRound})</span><strong>{lulus}</strong></td>
        <td><span>Subjek Gred F ({latestRound})</span><strong>{gredF}</strong></td>
      </tr></tbody></table>
      <table className="ppd-table">
        <thead><tr><th className="ppd-subject">Mata Pelajaran</th>{academicRounds.map((r) => <th key={r.code} colSpan={2}>{r.code}</th>)}</tr>
          <tr className="ppd-sub"><th></th>{academicRounds.map((r) => [<th key={r.code + 'm'}>Markah</th>, <th key={r.code + 'g'}>Gred</th>])}</tr></thead>
        <tbody>{academicSubjects.map((s) => <tr key={s.code}><td className="ppd-subject">{s.name}</td>{academicRounds.map((r) => {
          const c = cell(s.code, r.code);
          return [<td key={r.code + 'm'} className="ppd-num">{c?.score ?? '—'}</td>, <td key={r.code + 'g'} className="ppd-num"><strong>{c?.grade || '—'}</strong></td>];
        })}</tr>)}</tbody>
        <tfoot><tr><td className="ppd-subject">Purata markah</td>{academicRounds.map((r) => <td key={r.code} colSpan={2} className="ppd-num">{fmt(roundAvg(r.code))}</td>)}</tr></tfoot>
      </table>
    </section>}

    {pbdRounds.length > 0 && <section className="ppd-section">
      <h2>{next()}. Pentaksiran Bilik Darjah (PBD)</h2>
      <table className="ppd-table">
        <thead><tr><th className="ppd-subject">Mata Pelajaran</th>{pbdRounds.map((r) => <th key={r.code}>{r.code}</th>)}</tr></thead>
        <tbody>{pbdSubjects.map((s) => <tr key={s.code}><td className="ppd-subject">{s.name}</td>{pbdRounds.map((r) => {
          const c = pbd.find((x) => (x.subject_code || x.subject) === s.code && x.assessment === r.code);
          return <td key={r.code} className="ppd-num"><strong>{c ? `TP${c.tp}` : '—'}</strong></td>;
        })}</tr>)}</tbody>
      </table>
      <p className="ppd-note">Taburan Tahap Penguasaan ({latestPbd}): {[1, 2, 3, 4, 5, 6].map((tp) => `TP${tp}: ${tpCount(tp)}`).join(' · ')}. {latestPbdRows.filter((x) => x.tp >= 3).length} subjek mencapai TP3–TP6.</p>
    </section>}

    {psy && <PsySection p={psy} letter={next()} />}

    <footer className="ppd-footer">
      <span>Laporan ini dicetak daripada Sistem Pengurusan Akademik dan Pentaksiran {SCHOOL_NAME}.</span>
      <span>Tarikh cetakan: {printed}</span>
    </footer>
  </div>;
}

function PsySection({ p, letter }: { p: ParentPsychometric; letter: string }) {
  const profile = p as unknown as PsyProfile;
  const tags = tagCodes(profile);
  return <section className="ppd-section ppd-psy">
    <h2>{letter}. Pentaksiran Psikometrik {p.school_year}</h2>
    <p className="ppd-lead">{FORMAT_TITLES[p.format]}</p>
    {tags.length > 0 && <p className="ppd-dominant"><strong>{p.format === 'T4_APTITUD' ? 'Kekuatan murid: ' : tags.length > 1 ? 'Kecerdasan dominan (skor sama tinggi): ' : 'Kecerdasan dominan: '}</strong>{tags.map((c) => MI_LABELS[c]).join(', ')}</p>}

    {p.format === 'T4_APTITUD' ? <>
      {(() => { const s = aptitudeStrengths(p.aptitude); return s ? <p className="ppd-note">Verbal Linguistik (BM + BI): {s.VL}% · Logik Matematik: {s.LM}%</p> : null; })()}
      <table className="ppd-table">
        <thead><tr><th>Domain</th><th className="ppd-subject">Kemahiran</th><th>Skor</th><th>Interpretasi</th></tr></thead>
        <tbody>{(p.aptitude || []).map((k) => <tr key={k.key}>
          <td>{k.section === 'BM' ? 'Bahasa Melayu' : k.section === 'BI' ? 'Bahasa Inggeris' : 'Logik Matematik'}</td>
          <td className="ppd-subject">{k.label}</td><td className="ppd-num">{k.score} / {k.max}</td>
          <td><strong>{k.baik ? 'Baik' : 'Kurang Potensi'}</strong> (Baik ≥ {k.threshold})</td>
        </tr>)}</tbody>
      </table>
      <dl className="ppd-defs"><dt>Verbal Linguistik</dt><dd>{MI_DESCRIPTIONS.VL}</dd><dt>Logik Matematik</dt><dd>{MI_DESCRIPTIONS.LM}</dd></dl>
    </> : <>
      <table className="ppd-table ppd-mi">
        <thead><tr><th className="ppd-subject">Kecerdasan</th><th>Skor</th><th>Tahap</th><th className="ppd-desc">Penerangan</th></tr></thead>
        <tbody>{MI_CODES.filter((c) => typeof p.scores?.[c] === 'number').map((c) => {
          const v = p.scores![c] as number;
          return <tr key={c} className={tags.includes(c) ? 'ppd-highlight' : ''}>
            <td className="ppd-subject">{MI_LABELS[c]}{tags.includes(c) ? ' ★' : ''}</td>
            <td className="ppd-num">{v}%</td><td>{LEVEL[miLevel(p.format as 'T5_IKEP' | 'T6_APTITUD', v)]}</td>
            <td className="ppd-desc">{MI_DESCRIPTIONS[c]}</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="ppd-note">★ Kecerdasan dominan. Interpretasi skor: {LEVEL_BANDS[p.format as 'T5_IKEP' | 'T6_APTITUD']}.</p>
      {p.format === 'T6_APTITUD' && p.bahagian_b && <table className="ppd-table">
        <thead><tr><th className="ppd-subject">Bahagian B</th><th>Skor</th><th>Interpretasi</th></tr></thead>
        <tbody>{(['menaakul', 'masalah'] as const).map((k) => {
          const v = p.bahagian_b![k]; const t = BAHAGIAN_B_TEXT[k]; const ok = typeof v === 'number' && v >= 8;
          return <tr key={k}><td className="ppd-subject">{t.label}</td><td className="ppd-num">{typeof v === 'number' ? `${v} / 15` : '—'}</td>
            <td className="ppd-desc"><strong>{typeof v === 'number' ? (ok ? 'Baik' : 'Kurang Potensi') : 'Tiada skor'}</strong>{typeof v === 'number' ? ` — ${ok ? t.baik : t.kurang}` : ''}</td></tr>;
        })}</tbody>
      </table>}
    </>}
  </section>;
}
