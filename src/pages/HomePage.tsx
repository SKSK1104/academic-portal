import { BarChart3, BookOpenCheck, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { SCHOOL_NAME } from '../lib/constants';

const cards = [
  { to: '/semakan', icon: Search, title: 'Semakan Ibu Bapa', accent: 'purple' },
  { to: '/prestasi', icon: BarChart3, title: 'Prestasi Akademik', accent: 'blue' },
  { to: '/pbd', icon: BookOpenCheck, title: 'Pelaporan PBD', accent: 'green' },
  { to: '/guru', icon: ShieldCheck, title: 'Akses Guru', accent: 'amber' }
];

export function HomePage() {
  return <div className="landing">
    <section className="hero glass-hero">
      <div className="hero-badge">SISTEM PENGURUSAN AKADEMIK DAN PENTAKSIRAN</div>
      <h1>{SCHOOL_NAME}</h1>
    </section>
    <section className="portal-grid">
      {cards.map(({ to, icon: Icon, title, accent }) => <Link to={to} key={to} className="portal-card-link">
        <GlassCard className={`portal-card accent-${accent}`}>
          <div className="portal-icon"><Icon/></div>
          <h2>{title}</h2>
        </GlassCard>
      </Link>)}
    </section>
  </div>;
}
