import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, showToast: addToast, removeToast }}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          let icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;
          let borderClass = 'border-blue-200 bg-white text-slate-800';

          if (toast.type === 'success') {
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
            borderClass = 'border-emerald-200 bg-white text-slate-800';
          } else if (toast.type === 'error') {
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
            borderClass = 'border-rose-200 bg-white text-slate-800';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
            borderClass = 'border-amber-200 bg-white text-slate-800';
          }

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-lg border shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 ${borderClass}`}
            >
              <div className="flex items-center gap-3">
                {icon}
                <p className="text-sm font-medium leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const useOptionalToast = (): ToastContextType | undefined => {
  return useContext(ToastContext);
};
