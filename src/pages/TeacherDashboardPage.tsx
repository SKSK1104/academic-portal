import { BarChart3, BrainCircuit, FileSpreadsheet, FileUp, Target } from 'lucide-react';
import { Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';

const modules = [
  { to: '/guru/pengisian', icon: FileSpreadsheet, title: 'Pengisian AR', desc: 'TOV, AR semasa dan ETR. UASA tidak perlu ditaip manual.' },
  { to: '/guru/import', icon: FileUp, title: 'Import Data', desc: 'Roster CSV, migrasi AR1 Excel, UASA PDF dan PBD PDF.' },
  { to: '/guru/analisis', icon: BarChart3, title: 'Analisis Akademik', desc: 'Headcount, trend, gred dan intervensi AR/UASA.' },
  { to: '/guru/pbd', icon: Target, title: 'Analisis PBD', desc: 'TP1–TP6, MTM, intervensi dan trend PBD.' },
  { to: '/guru/kecerdasan', icon: BrainCircuit, title: 'Kecerdasan Pelbagai', desc: 'Struktur tersedia; parser akan ditambah apabila format PDF diterima.' }
];

export function TeacherDashboardPage() {
  return <>
    <PageHeader eyebrow="PORTAL GURU" title="Dashboard" description="Pilih kerja yang hendak dilakukan. Operasi data harian tidak memerlukan perubahan kod." />
    <div className="bento-grid module-grid">
      {modules.map(({ to, icon: Icon, title, desc }) => <Link to={to} key={to} className="module-link">
        <GlassCard className="module-card">
          <div className="module-icon"><Icon/></div><h2>{title}</h2><p>{desc}</p><span>Buka →</span>
        </GlassCard>
      </Link>)}
    </div>
  </>;
}
