import { useState } from 'react';
import { resolveUiError } from '../utils/uiFeedback';

export const useAsyncAction = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (action, options = {}) => {
    setLoading(true);
    setError('');
    try {
      return await action();
    } catch (err) {
      const { inlineMessage } = resolveUiError(err, {
        fallbackMessage: options.fallbackMessage || 'Action failed. Please retry.',
        toast: options.toast,
        toastOnError: options.toastOnError,
        toastMessage: options.toastMessage,
        inline: options.inline ?? true,
      });
      setError(inlineMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError('');

  return { loading, error, run, clearError };
};
