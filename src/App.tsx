import { Navigate, Route, Routes } from 'react-router';
import { PublicShell, TeacherShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AcademicAnalysisPage } from './pages/AcademicAnalysisPage';
import { HomePage } from './pages/HomePage';
import { ImportCenterPage } from './pages/ImportCenterPage';
import { IntelligencePlaceholderPage } from './pages/IntelligencePlaceholderPage';
import { MarkEntryPage } from './pages/MarkEntryPage';
import { ParentSearchPage } from './pages/ParentSearchPage';
import { PbdAnalysisPage } from './pages/PbdAnalysisPage';
import { PublicAcademicPage } from './pages/PublicAcademicPage';
import { PublicPbdPage } from './pages/PublicPbdPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';
import { TeacherLoginPage } from './pages/TeacherLoginPage';

export default function App() {
  return <Routes>
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
  </Routes>;
}
