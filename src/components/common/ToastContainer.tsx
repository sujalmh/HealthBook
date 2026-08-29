import React, { useEffect, useState } from 'react';
import { eventBus, ToastMessage } from '@/core/events/eventBus';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsub = eventBus.onToast((newToast) => {
      setToasts((prev) => [...prev, newToast]);

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 4000);

      return () => clearTimeout(timer);
    });

    return () => unsub();
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-sky-400 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-emerald-950/90 text-emerald-100';
      case 'error':
        return 'border-rose-200 bg-rose-950/90 text-rose-100';
      case 'warning':
        return 'border-amber-200 bg-amber-950/90 text-amber-100';
      case 'info':
      default:
        return 'border-sky-500/40 bg-white/95 text-slate-900';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-up ${getBorderColor(
            toast.type
          )}`}
          role="alert"
        >
          {getIcon(toast.type)}
          <div className="flex-1 text-sm">
            {toast.title && <div className="font-semibold text-xs uppercase tracking-wider mb-0.5">{toast.title}</div>}
            <div className="leading-snug">{toast.message}</div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-600 hover:text-slate-800 transition-colors p-0.5 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
