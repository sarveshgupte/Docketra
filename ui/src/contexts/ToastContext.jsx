/**
 * Enterprise Toast Context for notifications
 * Max 3 stacked toasts
 * All toasts auto-dismiss after 4 seconds by default
 */

import React, { createContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SESSION_KEYS } from '../utils/constants';

export const ToastContext = createContext(null);

const TOAST_META = {
  success: { icon: '✅', borderColor: '#D1D5DB' },
  warning: { icon: '⚠️', borderColor: '#FDE68A' },
  info: { icon: 'ℹ️', borderColor: '#CBD5E1' },
  danger: { icon: '🔴', borderColor: '#FECACA' },
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

  const value = {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

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
    <>
      <div
        style={{
          position: 'fixed',
          right: 'var(--space-4)',
          bottom: 'var(--space-4)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          alignItems: 'flex-end',
          width: 'min(360px, calc(100vw - 32px))',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const meta = TOAST_META[toast.type] || TOAST_META.info;

          return (
            <div
              key={toast.id}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${meta.borderColor}`,
                background: 'var(--color-surface)',
                color: 'var(--text-main)',
                wordBreak: 'break-word',
                pointerEvents: 'auto',
                animation: 'toastSlideIn 160ms ease-out',
              }}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true" style={{ lineHeight: 1.2 }}>{meta.icon}</span>
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translate3d(12px, 12px, 0);
            opacity: 0;
          }
          to {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  ), document.body);
};
