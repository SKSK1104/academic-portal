import { BarChart3, BookOpenCheck, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { SCHOOL_NAME } from '../lib/constants';

const cards = [
  { to: '/semakan', icon: Search, title: 'Semakan Ibu Bapa', desc: 'Semak prestasi anak menggunakan MyKid.', accent: 'purple' },
  { to: '/prestasi', icon: BarChart3, title: 'Prestasi Akademik', desc: 'Analisis agregat AR dan UASA tanpa maklumat peribadi murid.', accent: 'blue' },
  { to: '/pbd', icon: BookOpenCheck, title: 'Pelaporan PBD', desc: 'Rumusan TP1 hingga TP6, MTM dan trend PBD.', accent: 'green' },
  { to: '/guru', icon: ShieldCheck, title: 'Portal Guru', desc: 'Pengisian AR, import dokumen dan analisis dalaman.', accent: 'amber' }
];

export function HomePage() {
  return <div className="landing">
    <section className="hero glass-hero">
      <div className="hero-badge">PORTAL AKADEMIK 2.0</div>
      <h1>{SCHOOL_NAME}</h1>
      <p>Satu portal untuk pengisian, import, analisis dan pelaporan akademik. Data berkembang melalui portal — bukan melalui perubahan kod.</p>
    </section>
    <section className="portal-grid">
      {cards.map(({ to, icon: Icon, title, desc, accent }) => <Link to={to} key={to} className="portal-card-link">
        <GlassCard className={`portal-card accent-${accent}`}>
          <div className="portal-icon"><Icon/></div>
          <h2>{title}</h2>
          <p>{desc}</p>
          <span className="card-link-label">Buka modul →</span>
        </GlassCard>
      </Link>)}
    </section>
  </div>;
}
