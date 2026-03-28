import React, { useState } from 'react';

export function GoogleSignIn({ firmSlug, onError }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleGoogleLogin = () => {
    if (loading) return;
    if (!firmSlug) {
      const message = 'Firm context is required for Google login.';
      setLocalError(message);
      onError?.(new Error(message));
      return;
    }

    setLoading(true);
    setLocalError('');

    try {
      const url = new URL('/api/auth/google/login', window.location.origin);
      url.searchParams.set('firmSlug', firmSlug);
      window.location.assign(url.toString());
    } catch (error) {
      setLoading(false);
      setLocalError('Unable to start Google login. Please try again.');
      onError?.(error);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Connecting to Google...' : 'Continue with Google'}
      </button>
      {localError ? <p className="text-xs text-red-600">{localError}</p> : null}
    </div>
  );
}

export default GoogleSignIn;
