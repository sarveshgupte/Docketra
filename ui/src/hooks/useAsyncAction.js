import { useState } from 'react';

export const useAsyncAction = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setLoading(true);
    setError('');
    try {
      return await action();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Action failed. Please retry.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError('');

  return { loading, error, run, clearError };
};
