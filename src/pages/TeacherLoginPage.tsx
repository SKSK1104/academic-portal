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
      <div className="login-icon"><LockKeyhole/></div>
      <div className="eyebrow">AKSES GURU</div>
      <h1>Sistem Pengurusan Akademik dan Pentaksiran</h1>
      <label>Kata Laluan</label>
      <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata laluan" />
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Menyemak...' : 'Masuk'}</button>
    </form>
  </div>;
}
