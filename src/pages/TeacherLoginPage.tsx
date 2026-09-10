import { LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function TeacherLoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from || '/guru'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signIn(password); }
    catch { setError('Kata laluan tidak sah.'); }
    finally { setBusy(false); }
  }

  return <div className="login-page">
    <form className="glass-card login-card" onSubmit={submit}>
      <div className="login-icon" style={{
        width: 64,
        height: 64,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 20,
        color: '#bff6ff',
        background: 'linear-gradient(145deg, rgba(72,220,255,.24), rgba(91,140,255,.16) 55%, rgba(159,120,255,.18))',
        border: '1px solid rgba(156,228,255,.46)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), 0 12px 30px rgba(41,168,255,.18), 0 0 24px rgba(72,220,255,.13)',
        marginBottom: 28
      }}><LockKeyhole size={30} strokeWidth={1.9}/></div>
      <div className="eyebrow">AKSES GURU</div>
      <h1>Sistem Pengurusan Akademik dan Pentaksiran</h1>
      <label>Kata Laluan</label>
      <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata laluan" />
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Menyemak...' : 'Masuk'}</button>
    </form>
  </div>;
}
