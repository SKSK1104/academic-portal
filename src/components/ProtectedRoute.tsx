import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="screen-center"><div className="spinner" /> Memuatkan...</div>;
  if (!session) return <Navigate to="/guru/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
