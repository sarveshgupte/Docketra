/**
 * Enterprise Toast Context for notifications
 * Max 3 stacked toasts
 * All toasts auto-dismiss after 4 seconds by default
 */

import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { SESSION_KEYS } from '../utils/constants';
import { cn } from '../lib/utils';

export const ToastContext = createContext(null);

const TOAST_META = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />,
    className: 'bg-white border-emerald-200/90 text-slate-800 shadow-lg dark:bg-slate-900 dark:border-emerald-800/60 dark:text-slate-100',
  },
  warning: {
    icon: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
    className: 'bg-white border-amber-200/90 text-slate-800 shadow-lg dark:bg-slate-900 dark:border-amber-800/60 dark:text-slate-100',
  },
  info: {
    icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    className: 'bg-white border-blue-200/90 text-slate-800 shadow-lg dark:bg-slate-900 dark:border-blue-800/60 dark:text-slate-100',
  },
  danger: {
    icon: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />,
    className: 'bg-white border-rose-200/90 text-slate-800 shadow-lg dark:bg-slate-900 dark:border-rose-800/60 dark:text-slate-100',
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />,
    className: 'bg-white border-rose-200/90 text-slate-800 shadow-lg dark:bg-slate-900 dark:border-rose-800/60 dark:text-slate-100',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', persistent = false) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return null;

    // Deduplicate identical toasts emitted in quick succession (within 2500ms)
    const cacheKey = `${type}:${normalizedMessage}`;
    const now = Date.now();
    const lastEmitted = recentToastsRef.current.get(cacheKey) || 0;
    if (now - lastEmitted < 2500) {
      return null;
    }
    recentToastsRef.current.set(cacheKey, now);

    const id = `${now}-${Math.random().toString(36).slice(2, 9)}`;
    const toast = { id, message: normalizedMessage, type };

    setToasts((prev) => {
      const newToasts = [...prev, toast];
      return newToasts.slice(-3);
    });

    if (!persistent) {
      const timeoutMap = {
        success: 4000,
        warning: 4000,
        info: 4000,
        danger: 4000,
        error: 4000,
      };
      const timeout = timeoutMap[type] ?? 0;

      if (timeout > 0) {
        setTimeout(() => {
          removeToast(id);
        }, timeout);
      }
    }

    return id;
  }, [removeToast]);

  const showSuccess = useCallback((message) => {
    return addToast(message, 'success', false);
  }, [addToast]);

  const showError = useCallback((message) => {
    return addToast(message, 'danger', false);
  }, [addToast]);

  const showWarning = useCallback((message) => {
    return addToast(message, 'warning', false);
  }, [addToast]);

  const showInfo = useCallback((message) => {
    return addToast(message, 'info', false);
  }, [addToast]);

  const value = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }), [toasts, addToast, removeToast, showSuccess, showError, showWarning, showInfo]);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEYS.GLOBAL_TOAST);
    if (stored) {
      try {
        const { message, type = 'info' } = JSON.parse(stored);
        addToast(message, type);
      } catch {
        // Ignore malformed payload
      } finally {
        sessionStorage.removeItem(SESSION_KEYS.GLOBAL_TOAST);
      }
    }

    const handleIdempotent = () => {
      addToast('This action was already completed earlier.', 'info');
    };

    window.addEventListener('app:idempotent', handleIdempotent);
    return () => {
      window.removeEventListener('app:idempotent', handleIdempotent);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const meta = TOAST_META[toast.type] || TOAST_META.info;

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full items-start gap-2.5 rounded-[var(--dt-radius-card,8px)] border p-3 shadow-lg transition-[transform,opacity] duration-200 ease-out',
              meta.className
            )}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" className="shrink-0 mt-0.5">
              {meta.icon}
            </span>
            <span className="flex-1 break-words text-xs font-medium leading-relaxed">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 transition-colors hover:text-slate-700 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 cursor-pointer"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  ), document.body);
};
