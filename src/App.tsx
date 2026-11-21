import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { ToastProvider } from './context/ToastContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
