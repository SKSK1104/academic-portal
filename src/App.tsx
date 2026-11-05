import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PublicShell, TeacherShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GuidePage } from './pages/GuidePage';
import { SecretaryAssessmentSetup } from './components/SecretaryAssessmentSetup';
import { StudentManagement } from './components/StudentManagement';

const AcademicAnalysisPage = lazy(() => import('./pages/AcademicAnalysisPage').then((m) => ({ default: m.AcademicAnalysisPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ImportCenterPage = lazy(() => import('./pages/ImportCenterPage').then((m) => ({ default: m.ImportCenterPage })));
const IntelligencePage = lazy(() => import('./pages/IntelligencePage').then((m) => ({ default: m.IntelligencePage })));
const MarkEntryPage = lazy(() => import('./pages/MarkEntryPage').then((m) => ({ default: m.MarkEntryPage })));
const ParentSearchPage = lazy(() => import('./pages/ParentSearchPage').then((m) => ({ default: m.ParentSearchPage })));
const PbdAnalysisPage = lazy(() => import('./pages/PbdAnalysisPage').then((m) => ({ default: m.PbdAnalysisPage })));
const PublicAcademicPage = lazy(() => import('./pages/PublicAcademicPage').then((m) => ({ default: m.PublicAcademicPage })));
const PublicPsychometricPage = lazy(() => import('./pages/PublicPsychometricPage').then((m) => ({ default: m.PublicPsychometricPage })));
const PublicPbdPage = lazy(() => import('./pages/PublicPbdPage').then((m) => ({ default: m.PublicPbdPage })));
const TeacherDashboardPage = lazy(() => import('./pages/TeacherDashboardPage').then((m) => ({ default: m.TeacherDashboardPage })));
const TeacherLoginPage = lazy(() => import('./pages/TeacherLoginPage').then((m) => ({ default: m.TeacherLoginPage })));

function RouteLoader() {
  return <div className="route-loading" role="status" aria-live="polite">Memuatkan portal…</div>;
}

type ImportTask = 'UASA' | 'PBD' | 'ROSTER' | 'SETUP';
const IMPORT_TASKS: Array<{ key: ImportTask; title: string; note: string }> = [
  { key: 'UASA', title: 'Muat Naik UASA', note: 'PDF keputusan UASA satu kelas' },
  { key: 'PBD', title: 'Muat Naik PBD', note: 'PDF PBD 1 atau PBD 2' },
  { key: 'ROSTER', title: 'Kemas Kini Murid', note: 'Murid masuk, pindah, roster penuh' },
  { key: 'SETUP', title: 'Tetapan Pusingan', note: 'Aktifkan AR / UASA (Setiausaha)' }
];

function ImportDataRoute() {
  const [task, setTask] = useState<ImportTask>('UASA');
  return <>
    <h1 className="import-page-title">Import Data</h1>
    <div className="import-task-grid">
      {IMPORT_TASKS.map((t) => <button key={t.key} type="button" className={`import-task-card${task === t.key ? ' active' : ''}`} onClick={() => setTask(t.key)}><strong>{t.title}</strong><span>{t.note}</span></button>)}
    </div>
    {task === 'SETUP' && <SecretaryAssessmentSetup/>}
    {task === 'ROSTER' && <StudentManagement/>}
    {task !== 'SETUP' && <ImportCenterPage mode={task}/>}
  </>;
}

export default function App() {
  return <Suspense fallback={<RouteLoader />}>
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<HomePage />} />
        <Route path="semakan" element={<ParentSearchPage />} />
        <Route path="prestasi" element={<PublicAcademicPage />} />
        <Route path="pbd" element={<PublicPbdPage />} />
        <Route path="psikometrik" element={<PublicPsychometricPage />} />
        <Route path="guru/login" element={<TeacherLoginPage />} />
      </Route>
      <Route path="guru" element={<ProtectedRoute><TeacherShell /></ProtectedRoute>}>
        <Route index element={<TeacherDashboardPage />} />
        <Route path="pengisian" element={<MarkEntryPage />} />
        <Route path="import" element={<ImportDataRoute />} />
        <Route path="analisis" element={<AcademicAnalysisPage />} />
        <Route path="pbd" element={<PbdAnalysisPage />} />
        <Route path="panduan" element={<GuidePage />} />
        <Route path="kecerdasan" element={<IntelligencePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>;
}
