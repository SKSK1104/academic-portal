import { BarChart3, BookOpenCheck, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { SCHOOL_NAME } from '../lib/constants';

const cards = [
  { to: '/semakan', icon: Search, title: 'Semakan Ibu Bapa', description: 'Semak pencapaian anak anda', accent: 'purple' },
  { to: '/prestasi', icon: BarChart3, title: 'Prestasi Akademik', description: 'Analisis dan pencapaian murid', accent: 'blue' },
  { to: '/pbd', icon: BookOpenCheck, title: 'Pelaporan PBD', description: 'Laporan pentaksiran bersepadu', accent: 'green' },
  { to: '/guru', icon: ShieldCheck, title: 'Akses Guru', description: 'Sistem untuk guru', accent: 'amber' }
];

export function HomePage() {
  return <div className="landing">
    <section className="hero glass-hero">
      <div className="hero-badge">SISTEM PENGURUSAN AKADEMIK DAN PENTAKSIRAN</div>
      <h1>{SCHOOL_NAME}</h1>
    </section>
    <section className="portal-grid">
      {cards.map(({ to, icon: Icon, title, description, accent }) => <Link to={to} key={to} className="portal-card-link">
        <GlassCard className={`portal-card accent-${accent}`}>
          <div className="portal-icon"><Icon/></div>
          <h2>{title}</h2>
          <p>{description}</p>
          <span className="portal-arrow" aria-hidden="true">→</span>
        </GlassCard>
      </Link>)}
    </section>
  </div>;
}
