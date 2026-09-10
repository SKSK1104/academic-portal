import { BarChart3, BookOpenCheck, BrainCircuit, FileUp, Home, LogOut, Search, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { SCHOOL_NAME } from '../lib/constants';
import { SCHOOL_LOGO_DATA_URI } from '../lib/schoolLogo';

const teacherLinks = [
  { to: '/guru', label: 'Dashboard', icon: Home, end: true },
  { to: '/guru/pengisian', label: 'Pengisian AR', icon: BookOpenCheck },
  { to: '/guru/import', label: 'Import Data', icon: FileUp },
  { to: '/guru/analisis', label: 'Analisis Akademik', icon: BarChart3 },
  { to: '/guru/pbd', label: 'Analisis PBD', icon: Search },
  { to: '/guru/kecerdasan', label: 'Kecerdasan Pelbagai', icon: BrainCircuit }
];

function Brand({ teacher = false }: { teacher?: boolean }) {
  return <div className="brand pristine-brand">
    <img className="school-crest" src={SCHOOL_LOGO_DATA_URI} alt="Lencana SK Simpang Kuda" />
    <div className="brand-copy"><strong>{SCHOOL_NAME}</strong><small>{teacher ? 'Sistem Pengurusan Akademik dan Pentaksiran · Akses Guru' : 'Sistem Pengurusan Akademik dan Pentaksiran'}</small></div>
  </div>;
}

export function PublicShell() {
  return <div className="app-root pristine-root">
    <header className="topbar pristine-topbar">
      <Link to="/" aria-label={SCHOOL_NAME}><Brand /></Link>
      <Link className="btn btn-ghost" to="/guru"><ShieldCheck size={16}/> Akses Guru</Link>
    </header>
    <main className="public-main"><Outlet /></main>
    <footer className="footer">© {new Date().getFullYear()} {SCHOOL_NAME} • Sistem Pengurusan Akademik dan Pentaksiran</footer>
  </div>;
}

export function TeacherShell() {
  const { signOut } = useAuth();
  return <div className="teacher-layout pristine-root">
    <aside className="sidebar pristine-sidebar">
      <Link to="/guru" className="sidebar-brand-link"><Brand teacher /></Link>
      <div className="school-motto" aria-label="Cergas Punca Cerdas"><span>CERGAS</span><span>PUNCA</span><span>CERDAS</span></div>
      <nav className="side-nav">
        {teacherLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          <Icon size={18}/><span>{label}</span>
        </NavLink>)}
      </nav>
      <button className="side-link logout" onClick={() => signOut()}><LogOut size={18}/> Log Keluar</button>
    </aside>
    <div className="teacher-content">
      <header className="mobile-teacher-bar">
        <div className="mobile-brand"><img src={SCHOOL_LOGO_DATA_URI} alt=""/><span>{SCHOOL_NAME}</span></div>
        <button className="icon-button" onClick={() => signOut()}><LogOut size={17}/></button>
      </header>
      <main className="teacher-main"><Outlet /></main>
    </div>
  </div>;
}
