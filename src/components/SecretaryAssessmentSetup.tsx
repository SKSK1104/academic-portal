import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createNextAr, createNextUasa, getAssessments, getAvailableYears, uasaRound } from '../lib/data';
import type { Assessment } from '../lib/types';

export function SecretaryAssessmentSetup() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [arRounds, setArRounds] = useState<Assessment[]>([]);
  const [uasaRounds, setUasaRounds] = useState<Assessment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getAvailableYears().then((ys) => {
      setYears(ys);
      if (ys[0]) setYear(ys[0]);
    }).catch((e) => setMessage(e.message));
  }, []);

  useEffect(() => { if (year) void loadRounds(year); }, [year]);

  async function loadRounds(schoolYear: number) {
    try {
      const [ars, uasas] = await Promise.all([getAssessments(schoolYear, 'AR'), getAssessments(schoolYear, 'UASA')]);
      setArRounds(ars);
      setUasaRounds(uasas);
    } catch (e: any) { setMessage(e.message || String(e)); }
  }

  const nextAr = Math.max(0, ...arRounds.map((a) => Number(a.sequence_no || String(a.code).replace(/\D/g, '') || 0))) + 1;
  const nextUasa = Math.max(0, ...uasaRounds.map((a) => uasaRound(a.code))) + 1;

  async function add(kind: 'AR' | 'UASA') {
    setBusy(true); setMessage('');
    try {
      if (kind === 'AR') await createNextAr(year); else await createNextUasa(year);
      await loadRounds(year);
      setMessage(`${kind === 'AR' ? `AR${nextAr}` : `UASA ${nextUasa}`} berjaya ditambah untuk ${year}.`);
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setBusy(false); }
  }

  const chipLabel = (a: Assessment) => a.kind === 'UASA' ? `UASA ${uasaRound(a.code)}` : a.code;

  return <section className="secretary-setup no-print">
    <div className="secretary-heading"><div><h2>Tetapan Pusingan</h2><span className="setup-note">Untuk Setiausaha</span></div>
      <label className="year-inline">Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
    </div>
    <div className="round-rows">
      {([['AR', arRounds, `AR${nextAr}`, nextAr <= 10], ['UASA', uasaRounds, `UASA ${nextUasa}`, nextUasa <= 4]] as const).map(([kind, list, nextLabel, canAdd]) => <div className="round-row" key={kind}>
        <strong className="round-kind">{kind}</strong>
        <div className="round-chips">{list.length ? list.map((a) => <span className="round-chip" key={a.id}>{chipLabel(a)}</span>) : <span className="round-empty">Belum ada</span>}</div>
        <button className="btn btn-primary" disabled={busy || !canAdd} onClick={() => void add(kind)}><Plus size={16}/>Tambah {nextLabel}</button>
      </div>)}
    </div>
    <p className="import-help">Pusingan yang ditambah tidak boleh dibuang, supaya markah sedia ada selamat.</p>
    {message && <div className={message.includes('berjaya') ? 'notice success' : 'notice'}>{message}</div>}
  </section>;
}
