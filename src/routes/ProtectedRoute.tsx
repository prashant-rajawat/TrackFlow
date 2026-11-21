import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/layout/AppShell';
import { DashboardSkeleton } from '../components/feedback/LoadingSkeleton';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full bg-white p-8 rounded-2xl border border-slate-200">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};
