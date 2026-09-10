import { BarChart3, BookOpenCheck, Search, ShieldCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { SCHOOL_NAME } from '../lib/constants';

const cards = [
  { to: '/semakan', icon: Search, title: 'Semakan Ibu Bapa', description: 'Semak pencapaian anak anda', accent: 'purple' },
  { to: '/prestasi', icon: BarChart3, title: 'Prestasi Akademik', description: 'Analisis dan pencapaian murid', accent: 'blue' },
  { to: '/pbd', icon: BookOpenCheck, title: 'Pelaporan PBD', description: 'Laporan pentaksiran bersepadu', accent: 'green' },
  { to: '/guru', icon: ShieldCheck, title: 'Akses Guru', description: 'Sistem untuk guru', accent: 'amber' }
];

const iconGlass: Record<string, CSSProperties> = {
  purple: {
    color: '#eadfff',
    background: 'linear-gradient(145deg, rgba(177,132,255,.30), rgba(98,71,219,.18))',
    border: '1px solid rgba(202,176,255,.48)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), 0 10px 28px rgba(121,81,255,.18), 0 0 24px rgba(164,124,255,.16)'
  },
  blue: {
    color: '#d9f8ff',
    background: 'linear-gradient(145deg, rgba(72,220,255,.30), rgba(65,111,255,.18))',
    border: '1px solid rgba(151,229,255,.50)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), 0 10px 28px rgba(53,163,255,.18), 0 0 24px rgba(72,220,255,.16)'
  },
  green: {
    color: '#d9fff1',
    background: 'linear-gradient(145deg, rgba(78,226,177,.30), rgba(32,151,130,.18))',
    border: '1px solid rgba(144,244,211,.48)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), 0 10px 28px rgba(48,191,152,.16), 0 0 24px rgba(78,226,177,.14)'
  },
  amber: {
    color: '#fff2bd',
    background: 'linear-gradient(145deg, rgba(255,209,102,.28), rgba(219,133,54,.18))',
    border: '1px solid rgba(255,226,151,.48)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.30), 0 10px 28px rgba(230,160,58,.16), 0 0 24px rgba(255,209,102,.13)'
  }
};

export function HomePage() {
  return <div className="landing">
    <section className="hero glass-hero">
      <div className="hero-badge">SISTEM PENGURUSAN AKADEMIK DAN PENTAKSIRAN</div>
      <h1>{SCHOOL_NAME}</h1>
    </section>
    <section className="portal-grid">
      {cards.map(({ to, icon: Icon, title, description, accent }) => <Link to={to} key={to} className="portal-card-link">
        <GlassCard className={`portal-card accent-${accent}`}>
          <div className="portal-icon" style={{
            ...iconGlass[accent],
            width: 54,
            height: 54,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 17,
            marginBottom: 18,
            backdropFilter: 'blur(14px) saturate(1.25)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.25)'
          }}><Icon size={26} strokeWidth={1.8}/></div>
          <h2>{title}</h2>
          <p>{description}</p>
          <span className="portal-arrow" aria-hidden="true">→</span>
        </GlassCard>
      </Link>)}
    </section>
  </div>;
}
