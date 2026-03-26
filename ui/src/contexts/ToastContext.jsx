/**
 * Enterprise Toast Context for notifications
 * Max 3 stacked toasts
 * All toasts auto-dismiss after 4 seconds by default
 */

import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SESSION_KEYS } from '../utils/constants';

export const ToastContext = createContext(null);

const TOAST_META = {
  success: { icon: '✓', iconClass: 'text-green-500' },
  warning: { icon: '!', iconClass: 'text-amber-500' },
  info: { icon: 'i', iconClass: 'text-blue-500' },
  danger: { icon: '!', iconClass: 'text-red-500' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', persistent = false) => {
    const id = Date.now();
    const toast = { id, message, type };

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
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => {
        const meta = TOAST_META[toast.type] || TOAST_META.info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-4 shadow-lg transition-all duration-300 ease-in-out ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`inline-flex h-5 w-5 items-center justify-center text-sm font-semibold leading-none ${meta.iconClass}`}
            >
              {meta.icon}
            </span>
            <span className="flex-1 break-words text-sm font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  ), document.body);
};
