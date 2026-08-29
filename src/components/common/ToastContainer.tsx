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
        // Dark for contrast floating notification — clinical emerald preserved (light theme exception justified)
        return 'border-emerald-200 bg-emerald-950/90 text-emerald-50 shadow-lg';
      case 'error':
        return 'border-rose-200 bg-rose-950/90 text-rose-50 shadow-lg';
      case 'warning':
        return 'border-amber-200 bg-amber-950/90 text-amber-50 shadow-lg';
      case 'info':
      default:
        return 'border-primary-border bg-white text-slate-900 shadow-lg';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 z-50 flex flex-col gap-2 max-w-md w-auto md:w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 animate-slide-up ${getBorderColor(
            toast.type
          )}`}
          role="alert"
          aria-live="polite"
        >
          {getIcon(toast.type)}
          <div className="flex-1 text-sm min-w-0">
            {toast.title && <div className="font-semibold text-caption uppercase tracking-wider mb-0.5">{toast.title}</div>}
            <div className="leading-snug">{toast.message}</div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-70 hover:opacity-100 transition-opacity p-2 rounded-xl hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1 -my-1"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
