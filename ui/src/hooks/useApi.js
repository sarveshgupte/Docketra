/**
 * useApi Hook
 * Generic hook for API calls with loading and error states
 */

import { useState, useCallback } from 'react';
import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');
  const toast = useContext(ToastContext);

  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      onSuccess,
      onError,
      showSuccessToast = false,
      showErrorToast = true,
      successMessage = 'Operation completed successfully',
      retryCount = 0,
      retryDelayMs = 400,
      shouldRetry,
    } = options;

    setLoading(true);
    setStatus('loading');
    setError(null);

    let lastError;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        const response = await apiCall();

        if (showSuccessToast && toast) {
          toast.showSuccess(successMessage);
        }

        if (onSuccess) {
          onSuccess(response);
        }

        setStatus('success');
        return response;
      } catch (err) {
        lastError = err;
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
        const allowRetry = attempt < retryCount && (shouldRetry ? shouldRetry(err, attempt) : true);

        if (allowRetry) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }

        setError(errorMessage);
        setStatus('error');

        if (showErrorToast && toast) {
          toast.showError(errorMessage);
        }

        if (onError) {
          onError(err);
        }

        throw err;
      }
    }

    throw lastError;
  }, [toast]);

  return {
    loading,
    error,
    status,
    execute,
  };
};
