import { LockKeyhole, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createNextAr, createNextUasa, getAssessments, getAvailableYears } from '../lib/data';
import type { Assessment } from '../lib/types';

export function SecretaryAssessmentSetup() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rounds, setRounds] = useState<Assessment[]>([]);
  const [uasaRounds, setUasaRounds] = useState<Assessment[]>([]);
  const [targetCount, setTargetCount] = useState(1);
  const [uasaTarget, setUasaTarget] = useState(1);
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
      setRounds(ars);
      setTargetCount(Math.max(1, ars.length));
      setUasaRounds(uasas);
      setUasaTarget(Math.max(1, uasas.length));
    } catch (e: any) { setMessage(e.message || String(e)); }
  }

  async function activateRounds() {
    if (targetCount <= rounds.length) {
      setMessage(`AR aktif sekarang: ${rounds.map((a) => a.code).join(', ') || 'tiada'}. Bilangan AR tidak dikurangkan untuk melindungi data sedia ada.`);
      return;
    }
    setBusy(true); setMessage('');
    try {
      let count = rounds.length;
      while (count < targetCount) {
        await createNextAr(year);
        count += 1;
      }
      await loadRounds(year);
      setMessage(`AR berjaya diaktifkan sehingga AR${targetCount}.`);
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function activateUasa() {
    if (uasaTarget <= uasaRounds.length) return;
    setBusy(true); setMessage('');
    try {
      let count = uasaRounds.length;
      while (count < uasaTarget) {
        await createNextUasa(year);
        count += 1;
      }
      await loadRounds(year);
      setMessage(`UASA berjaya diaktifkan sehingga UASA ${uasaTarget}.`);
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return <section className="secretary-setup no-print">
    <div className="secretary-heading"><div><LockKeyhole size={18}/><span>SETIAUSAHA PEPERIKSAAN SAHAJA</span></div><strong>Tetapan Pusingan AR &amp; UASA</strong></div>
    <div className="secretary-controls">
      <label>Tahun<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <label>Bilangan AR<input type="number" min={Math.max(1, rounds.length)} max={10} value={targetCount} onChange={(e) => setTargetCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}/></label>
      <div className="secretary-current"><span>AR Aktif</span><strong>{rounds.length ? rounds.map((a) => a.code).join(' · ') : 'Tiada AR'}</strong></div>
      <button className="btn btn-primary" disabled={busy || targetCount <= rounds.length} onClick={activateRounds}><Plus size={16}/>{busy ? 'Mengaktifkan…' : 'Aktifkan AR'}</button>
    </div>
    <div className="secretary-controls">
      <label>Bilangan UASA<input type="number" min={Math.max(1, uasaRounds.length)} max={4} value={uasaTarget} onChange={(e) => setUasaTarget(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}/></label>
      <div className="secretary-current"><span>UASA Aktif</span><strong>{uasaRounds.length ? uasaRounds.map((a) => a.code).join(' · ') : 'Tiada UASA'}</strong></div>
      <button className="btn btn-primary" disabled={busy || uasaTarget <= uasaRounds.length} onClick={activateUasa}><Plus size={16}/>{busy ? 'Mengaktifkan…' : 'Aktifkan UASA'}</button>
    </div>
    {message && <div className={message.includes('berjaya') ? 'notice success' : 'notice'}>{message}</div>}
  </section>;
}
