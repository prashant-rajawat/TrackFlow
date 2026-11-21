import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { X, Bell, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';
import { CreateWorkspaceModal } from '../workspaces/CreateWorkspaceModal';
import { authService } from '../../services/auth.service';
import { HealthData } from '../../types/auth';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [devDbWarning, setDevDbWarning] = useState<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    let active = true;

    authService
      .checkHealth()
      .then((health: HealthData) => {
        if (!active || !health?.database) return;
        if (health.database.type === 'memory') {
          setDevDbWarning(
            health.database.warning ||
              'Development Notice: Running with ephemeral in-memory storage. Data resets on server restart — configure MONGODB_URI for persistence.'
          );
        } else if (!health.database.connected) {
          setDevDbWarning(
            health.database.error ||
              'Development Notice: Database is disconnected. Configure MONGODB_URI or set ALLOW_MEMORY_DB=true.'
          );
        }
      })
      .catch(() => {
        // Silent in case health check cannot be reached
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen">
        <Sidebar
          onOpenCreateWorkspaceModal={() => setCreateWorkspaceOpen(true)}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-50 flex flex-col">
            <div className="absolute top-4 right-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              onCloseMobile={() => setMobileMenuOpen(false)}
              onOpenCreateWorkspaceModal={() => {
                setMobileMenuOpen(false);
                setCreateWorkspaceOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenNotifications={() => setNotificationModalOpen(true)}
        />
        {!import.meta.env.PROD && devDbWarning && !warningDismissed && (
          <div
            role="status"
            className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium">{devDbWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setWarningDismissed(true)}
              className="p-1 rounded-md text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 shrink-0"
              aria-label="Dismiss development storage warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Real Workspace Creation Modal */}
      <CreateWorkspaceModal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
      />

      {/* Notifications Notice Modal */}
      {notificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Notification Center
                </h3>
                <p className="text-xs text-slate-500">Scheduled for Phase 9</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              The real-time notification engine, issue assignment alerts, and activity feed will be integrated in <strong>Phase 9</strong>. No mock notifications are faked.
            </p>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setNotificationModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
