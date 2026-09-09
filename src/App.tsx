import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PublicShell, TeacherShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

const AcademicAnalysisPage = lazy(() => import('./pages/AcademicAnalysisPage').then((m) => ({ default: m.AcademicAnalysisPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ImportCenterPage = lazy(() => import('./pages/ImportCenterPage').then((m) => ({ default: m.ImportCenterPage })));
const IntelligencePlaceholderPage = lazy(() => import('./pages/IntelligencePlaceholderPage').then((m) => ({ default: m.IntelligencePlaceholderPage })));
const MarkEntryPage = lazy(() => import('./pages/MarkEntryPage').then((m) => ({ default: m.MarkEntryPage })));
const ParentSearchPage = lazy(() => import('./pages/ParentSearchPage').then((m) => ({ default: m.ParentSearchPage })));
const PbdAnalysisPage = lazy(() => import('./pages/PbdAnalysisPage').then((m) => ({ default: m.PbdAnalysisPage })));
const PublicAcademicPage = lazy(() => import('./pages/PublicAcademicPage').then((m) => ({ default: m.PublicAcademicPage })));
const PublicPbdPage = lazy(() => import('./pages/PublicPbdPage').then((m) => ({ default: m.PublicPbdPage })));
const TeacherDashboardPage = lazy(() => import('./pages/TeacherDashboardPage').then((m) => ({ default: m.TeacherDashboardPage })));
const TeacherLoginPage = lazy(() => import('./pages/TeacherLoginPage').then((m) => ({ default: m.TeacherLoginPage })));

function RouteLoader() {
  return <div className="route-loading" role="status" aria-live="polite">Memuatkan portal…</div>;
}

export default function App() {
  return <Suspense fallback={<RouteLoader />}>
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<HomePage />} />
        <Route path="semakan" element={<ParentSearchPage />} />
        <Route path="prestasi" element={<PublicAcademicPage />} />
        <Route path="pbd" element={<PublicPbdPage />} />
        <Route path="guru/login" element={<TeacherLoginPage />} />
      </Route>
      <Route path="guru" element={<ProtectedRoute><TeacherShell /></ProtectedRoute>}>
        <Route index element={<TeacherDashboardPage />} />
        <Route path="pengisian" element={<MarkEntryPage />} />
        <Route path="import" element={<ImportCenterPage />} />
        <Route path="analisis" element={<AcademicAnalysisPage />} />
        <Route path="pbd" element={<PbdAnalysisPage />} />
        <Route path="kecerdasan" element={<IntelligencePlaceholderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>;
}
