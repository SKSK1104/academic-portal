import { Search, UserMinus, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';
import { supabase } from '../lib/supabase';

type EnrolmentRow = {
  id: string;
  school_year: number;
  year_level: number;
  class_name: string;
  is_active: boolean;
  status: string;
  students: { id: string; student_id: string; name: string; mykid: string; gender: string | null; religion: string | null; oku_status: string | null } | null;
};

type NewPupil = { name: string; mykid: string; yearLevel: number; className: string; gender: string; religion: string; mbpk: boolean };
const blankPupil = (yearLevel = 1, className = ''): NewPupil => ({ name: '', mykid: '', yearLevel, className, gender: '', religion: '', mbpk: false });

export function StudentManagement() {
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<EnrolmentRow[]>([]);
  const [query, setQuery] = useState('');
  const [newPupil, setNewPupil] = useState<NewPupil>(blankPupil());
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { void load(); }, [schoolYear]);

  async function load() {
    setMessage('');
    const { data, error } = await supabase
      .from('v2_enrolments')
      .select('id,school_year,year_level,class_name,is_active,status,students:v2_students!v2_enrolments_student_id_fkey(id,student_id,name,mykid,gender,religion,oku_status)')
      .eq('school_year', schoolYear)
      .order('year_level')
      .order('class_name');
    if (error) { setMessage(error.message); return; }
    const nextRows = (data || []) as unknown as EnrolmentRow[];
    setRows(nextRows);
    const firstClass = nextRows.find((r) => r.is_active)?.class_name || nextRows[0]?.class_name || '';
    const firstLevel = nextRows.find((r) => r.class_name === firstClass)?.year_level || 1;
    setNewPupil((p) => ({ ...p, className: p.className || firstClass, yearLevel: p.className ? p.yearLevel : firstLevel }));
  }

  const classes = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.class_name, Number(r.year_level)));
    return [...map.entries()].map(([className, yearLevel]) => ({ className, yearLevel })).sort((a, b) => a.yearLevel - b.yearLevel || a.className.localeCompare(b.className));
  }, [rows]);

  useEffect(() => { if (classes.length && !classes.some((c) => c.className === classFilter)) setClassFilter(classes[0].className); }, [classes]);
  const activeRows = useMemo(() => rows.filter((r) => r.is_active && (query.trim() || r.class_name === classFilter)), [rows, classFilter, query]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/\D/g, '') || query.trim().toUpperCase();
    if (!q) return activeRows;
    return activeRows.filter((r) => {
      const name = r.students?.name?.toUpperCase() || '';
      const mykid = (r.students?.mykid || '').replace(/\D/g, '');
      return name.includes(query.trim().toUpperCase()) || mykid.includes(query.replace(/\D/g, ''));
    });
  }, [activeRows, query]);

  async function markMovedOut(row: EnrolmentRow) {
    const name = row.students?.name || 'murid ini';
    if (!window.confirm(`Tandakan ${name} sebagai berpindah keluar? Rekod akademik lama akan kekal.`)) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('v2_enrolments').update({
      is_active: false,
      status: 'MOVED_OUT',
      left_on: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString()
    }).eq('id', row.id);
    if (error) setMessage(error.message);
    else { setMessage(`${name} dikeluarkan daripada roster aktif.`); await load(); }
    setBusy(false);
  }

  async function addPupil() {
    const name = newPupil.name.trim().toUpperCase();
    const mykid = newPupil.mykid.replace(/\D/g, '');
    if (!name || mykid.length !== 12 || !newPupil.className) {
      setMessage('Nama, MyKid 12 digit dan kelas diperlukan.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const existingStudent = await supabase.from('v2_students').select('id,student_id').eq('mykid', mykid).maybeSingle();
      if (existingStudent.error) throw existingStudent.error;
      let studentId = existingStudent.data?.id as string | undefined;
      if (!studentId) {
        const internalId = `MANUAL-${mykid}`;
        const inserted = await supabase.from('v2_students').insert({
          student_id: internalId,
          name,
          mykid,
          gender: newPupil.gender || null,
          religion: newPupil.religion || null,
          oku_status: newPupil.mbpk ? 'YA' : 'TIDAK',
          updated_at: new Date().toISOString()
        }).select('id').single();
        if (inserted.error) throw inserted.error;
        studentId = inserted.data.id;
      } else {
        const updated = await supabase.from('v2_students').update({
          name,
          gender: newPupil.gender || null,
          religion: newPupil.religion || null,
          oku_status: newPupil.mbpk ? 'YA' : 'TIDAK',
          updated_at: new Date().toISOString()
        }).eq('id', studentId);
        if (updated.error) throw updated.error;
      }

      const enrolment = await supabase.from('v2_enrolments').upsert({
        student_id: studentId,
        school_year: schoolYear,
        year_level: newPupil.yearLevel,
        class_name: newPupil.className,
        is_active: true,
        status: 'ACTIVE',
        left_on: null,
        status_note: 'MID_YEAR_IN',
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,school_year' });
      if (enrolment.error) throw enrolment.error;
      setMessage(`${name} ditambah ke roster aktif ${formatClass(newPupil.className)}.`);
      setNewPupil(blankPupil(newPupil.yearLevel, newPupil.className));
      await load();
    } catch (e: any) { setMessage(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return <section className="student-management-section">
    <div className="section-heading secretary-heading"><div><h2>Kemas Kini Murid</h2><span className="setup-note">Untuk Setiausaha</span></div><button type="button" className="btn btn-primary" onClick={() => { setShowAdd((v) => !v); const c = classes.find((x) => x.className === classFilter); if (c) setNewPupil((p) => ({ ...p, className: c.className, yearLevel: c.yearLevel })); }}><UserPlus size={16}/>{showAdd ? 'Tutup' : 'Tambah Murid Masuk'}</button></div>

    <div className={`student-management-grid${showAdd ? '' : ' single'}`}>
      <GlassCard className="student-admin-card premium-card">
        <div className="student-admin-head"><div><UserMinus size={20}/><h3>Senarai Murid Kelas</h3></div><div className="roster-filters"><label className="year-inline">Tahun<input type="number" value={schoolYear} onChange={(e) => setSchoolYear(Number(e.target.value))}/></label><label className="year-inline">Kelas<select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setQuery(''); }}>{classes.map((c) => <option value={c.className} key={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label></div></div>
        <div className="roster-count">{query.trim() ? `Hasil carian semua kelas: ${filtered.length} murid` : `${filtered.length} murid aktif dalam kelas ini`}</div>
        <div className="pupil-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama atau MyKid di semua kelas"/></div>
        <div className="pupil-admin-list">
          {filtered.length ? filtered.map((r) => <div className="pupil-admin-row" key={r.id}><div><strong>{r.students?.name || '—'}</strong><span>{r.year_level} {formatClass(r.class_name)}</span></div><button className="btn btn-danger" disabled={busy} onClick={() => void markMovedOut(r)}>Keluarkan</button></div>) : <div className="empty-inline">Tiada murid sepadan.</div>}
        </div>
      </GlassCard>

      {showAdd && <GlassCard className="student-admin-card premium-card">
        <div className="student-admin-head"><div><UserPlus size={20}/><h3>Murid Masuk</h3></div></div>
        <div className="pupil-form-grid">
          <label>Nama Murid<input value={newPupil.name} onChange={(e) => setNewPupil((p) => ({ ...p, name: e.target.value }))}/></label>
          <label>MyKid<input inputMode="numeric" maxLength={14} value={newPupil.mykid} onChange={(e) => setNewPupil((p) => ({ ...p, mykid: e.target.value }))}/></label>
          <label>Kelas<select value={newPupil.className} onChange={(e) => { const c = classes.find((x) => x.className === e.target.value); setNewPupil((p) => ({ ...p, className: e.target.value, yearLevel: c?.yearLevel || p.yearLevel })); }}>{classes.map((c) => <option value={c.className} key={c.className}>{c.yearLevel} {formatClass(c.className)}</option>)}</select></label>
          <label>Jantina<select value={newPupil.gender} onChange={(e) => setNewPupil((p) => ({ ...p, gender: e.target.value }))}><option value="">—</option><option value="L">Lelaki</option><option value="P">Perempuan</option></select></label>
          <label>Agama<input value={newPupil.religion} onChange={(e) => setNewPupil((p) => ({ ...p, religion: e.target.value }))}/></label>
          <label className="mbpk-toggle"><span>MBPK</span><input type="checkbox" checked={newPupil.mbpk} onChange={(e) => setNewPupil((p) => ({ ...p, mbpk: e.target.checked }))}/></label>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || !classes.length} onClick={() => void addPupil()}><UserPlus size={16}/> Tambah ke Roster Aktif</button>
      </GlassCard>}
    </div>
    {message && <div className={`notice ${message.includes('ditambah') || message.includes('dikeluarkan') ? 'success' : ''}`}>{message}</div>}
  </section>;
}

function formatClass(value: string) { return value ? value.charAt(0) + value.slice(1).toLowerCase() : ''; }
