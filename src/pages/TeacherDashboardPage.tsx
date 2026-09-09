import { BarChart3, BrainCircuit, FileSpreadsheet, FileUp, Target } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';

const modules = [
  { to: '/guru/pengisian', icon: FileSpreadsheet, title: 'Pengisian AR' },
  { to: '/guru/import', icon: FileUp, title: 'Import Data' },
  { to: '/guru/analisis', icon: BarChart3, title: 'Analisis Akademik' },
  { to: '/guru/pbd', icon: Target, title: 'Analisis PBD' },
  { to: '/guru/kecerdasan', icon: BrainCircuit, title: 'Kecerdasan Pelbagai' }
];

export function TeacherDashboardPage() {
  return <>
    <PageHeader eyebrow="PORTAL GURU" title="Dashboard" />
    <div className="bento-grid module-grid">
      {modules.map(({ to, icon: Icon, title }) => <Link to={to} key={to} className="module-link">
        <GlassCard className="module-card">
          <div className="module-icon"><Icon/></div><h2>{title}</h2>
        </GlassCard>
      </Link>)}
    </div>
  </>;
}
