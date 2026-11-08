/**
 * useToast Hook
 * Provides toast notification functionality
 */

import { useContext, useCallback } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { showError, addToast, showSuccess, showWarning, showInfo } = context;

  // Map showError to 'error' type (ToastContext uses 'danger')
  const showToast = useCallback((message, type = 'info') => {
    if (type === 'error') {
      return showError(message);
    }
    return addToast(message, type);
  }, [showError, addToast]);

  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    success: showSuccess,
    error: showError,
  };
};
