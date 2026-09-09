import { BarChart3, BookOpenCheck, BrainCircuit, FileUp, Home, LogOut, Search, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { SCHOOL_CODE, SCHOOL_NAME } from '../lib/constants';

const teacherLinks = [
  { to: '/guru', label: 'Dashboard', icon: Home, end: true },
  { to: '/guru/pengisian', label: 'Pengisian AR', icon: BookOpenCheck },
  { to: '/guru/import', label: 'Import Data', icon: FileUp },
  { to: '/guru/analisis', label: 'Analisis Akademik', icon: BarChart3 },
  { to: '/guru/pbd', label: 'Analisis PBD', icon: Search },
  { to: '/guru/kecerdasan', label: 'Kecerdasan Pelbagai', icon: BrainCircuit }
];

export function PublicShell() {
  return <div className="app-root">
    <header className="topbar">
      <Link to="/" className="brand">
        <div className="brand-mark">SK</div>
        <div><strong>{SCHOOL_NAME}</strong><small>{SCHOOL_CODE} • Portal Akademik 2.0</small></div>
      </Link>
      <Link className="btn btn-ghost" to="/guru"><ShieldCheck size={16}/> Akses Guru</Link>
    </header>
    <main className="public-main"><Outlet /></main>
    <footer className="footer">© {new Date().getFullYear()} {SCHOOL_NAME} • Sistem Akademik & Pentaksiran</footer>
  </div>;
}

export function TeacherShell() {
  const { signOut } = useAuth();
  return <div className="teacher-layout">
    <aside className="sidebar">
      <Link to="/guru" className="brand sidebar-brand">
        <div className="brand-mark">SK</div>
        <div><strong>{SCHOOL_NAME}</strong><small>Portal Guru 2.0</small></div>
      </Link>
      <nav className="side-nav">
        {teacherLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          <Icon size={18}/><span>{label}</span>
        </NavLink>)}
      </nav>
      <button className="side-link logout" onClick={() => signOut()}><LogOut size={18}/> Log Keluar</button>
    </aside>
    <div className="teacher-content">
      <header className="mobile-teacher-bar">
        <span>{SCHOOL_NAME}</span>
        <button className="icon-button" onClick={() => signOut()}><LogOut size={17}/></button>
      </header>
      <main className="teacher-main"><Outlet /></main>
    </div>
  </div>;
}
